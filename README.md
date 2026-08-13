# Loop CRM

CRM para un negocio pequeño (Marta, la dueña, y Carlos, su empleado), construido con Next.js 16 + Convex.

## Seguridad: login real + funciones de Convex autenticadas (PRO-44 + PRO-59)

Desde PRO-44 existe login real: email + contraseña, sesión con cookie httpOnly (`session_token`), verificada en `app/(app)/layout.tsx` antes de dejar entrar a cualquier pantalla del CRM (`proxy.ts` solo hace un check optimista de que la cookie exista, sin tocar Convex — la comprobación real vive en el layout, ver `lib/auth/session.ts`). Esa cookie es la puerta de **navegación** de Next.js.

Desde PRO-59, las funciones de Convex en sí (`clients.*`, `notes.*`, `followUps.*`, `sales.*`, y desde PRO-45 también `users.create`/`users.resetEmployeePassword`) también exigen autenticación — ya no basta con la URL del deployment y el nombre de la función. La cookie de sesión es httpOnly a propósito (para que un XSS no pueda robarla), lo que significa que el JavaScript del navegador nunca puede leerla directamente; en su lugar, cada una de esas 16 funciones exige un **accessToken** de corta duración, derivado de la sesión ya validada, que sí puede viajar en las llamadas de `convex/react`. El riesgo que este README aceptaba antes mientras el deployment tuviera datos ficticios ya no aplica a esta superficie.

### Cómo funciona la sesión (PRO-44)

- `convex/model/sessions.ts`: token opaco de 32 bytes (`crypto.getRandomValues`), guardado como `tokenHash` (SHA-256, `crypto.subtle.digest`) — el token en claro nunca se persiste; solo se **devuelve** al crearlo o rotarlo (`login`, `changePassword`), y después viaja en la cookie httpOnly en cada petición que lo necesita (`verify`, `logout`, `changePassword`).
- Máximo `MAX_SESSIONS_PER_USER = 5` sesiones activas por usuario: al hacer un sexto login, se revoca automáticamente la más antigua. Excepción deliberada a "la sesión se mantiene hasta cierre explícito" — documentada aquí para que no se lea como un bug.
- Cambiar la contraseña (`users.changePassword`, obligatorio tras aprovisionar o voluntario desde Ajustes) **rota** la sesión: cierra todas las sesiones del usuario, incluida la que hizo el cambio, y crea una nueva — si alguien había copiado la cookie con la contraseña antigua, deja de servirle. La cookie del navegador que hizo el cambio se sustituye en la misma respuesta, sin pedir volver a iniciar sesión.
- `deleteSessionAndAccessTokens` (`convex/model/sessions.ts`) es el **único** punto que borra una fila de `sessions` — usado por la expulsión de `createSessionForUser`, `destroySession` y `destroySessionsForUser`. Borra primero los `accessTokens` derivados de esa sesión y luego la sesión misma, así ningún camino puede dejar tokens huérfanos.
- Sin rate-limiting de intentos de login — riesgo aceptado explícitamente, herramienta interna sin usuarios públicos.

### Cómo funciona la autenticación de las funciones de Convex (PRO-59)

- `accessTokens` (`convex/schema.ts`): tabla independiente de `sessions` — no un campo único en ella — para que varias pestañas o dispositivos con la misma sesión puedan tener cada uno su propio accessToken vigente sin invalidarse entre sí. TTL de 20 min (`ACCESS_TOKEN_TTL_MS`), máximo 8 tokens activos por sesión (`MAX_ACCESS_TOKENS_PER_SESSION`) — al llegar al límite, emitir uno más desaloja el activo más antiguo.
- `sessions.issueAccessToken` (mutation pública, pero solo la llama `app/api/auth/convex-token/route.ts`, nunca un componente directamente): a partir del token de sesión largo (la cookie httpOnly), valida la sesión, rechaza si `mustChangePassword` está activo, limpia físicamente los tokens ya expirados de esa sesión y aplica el límite de 8 antes de emitir uno nuevo. También programa, vía `ctx.scheduler.runAfter`, la ejecución de `sessions.expireAccessToken` (internal mutation) exactamente `ACCESS_TOKEN_TTL_MS` después: Convex solo reevalúa una `query` en vivo cuando cambia un documento que leyó, nunca por el simple paso del tiempo, así que sin este borrado programado una suscripción que ya verificó el token una vez seguiría sirviendo el mismo resultado después de caducar, hasta que algún otro escritura no relacionada la tocara. `expireAccessTokenIfDue` (`convex/model/sessions.ts`) es idempotente ante una fila que ya no existe (sesión borrada, o token desalojado antes por el límite de 8).
- `verifyAccessToken`/`requireAccessToken` (`convex/model/sessions.ts` / `convex/model/auth.ts`): de solo lectura — nunca borran nada, ni siquiera un token ya expirado (esa limpieza física vive en `issueAccessToken` y en el borrado programado de arriba). Cada una de las 16 funciones de negocio usa `requireAccessToken(ctx, args.token)`, directamente o a través de `requireOwner` (`convex/model/auth.ts`, PRO-45 — envuelve a `requireAccessToken` y además exige `role === "owner"`, usado por `users.create`/`users.resetEmployeePassword`); si falla, lanza `ConvexError({ code: "UNAUTHENTICATED" })` (o `"FORBIDDEN"` si el token es válido pero el rol no alcanza). La comprobación de `expiresAt` contra `Date.now()` que hace `verifyAccessToken` es una defensa adicional (cubre la ventana antes de que el scheduler llegue a ejecutarse), no el mecanismo principal de invalidación.
- `app/api/auth/convex-token/route.ts` — único puente entre la cookie httpOnly y el navegador: `POST` únicamente (mutar/rotar credenciales vía `GET` sería vulnerable con `SameSite=Lax`), con validación de origen fail-closed (`Sec-Fetch-Site` si el navegador lo manda, si no `Origin` comparado contra el propio deployment; si faltan ambas cabeceras, rechaza) y `Cache-Control: private, no-store` en toda respuesta. `proxy.ts` excluye esta ruta exacta de su redirección a `/login`, para que pueda responder su propio 401/403 JSON en vez de una redirección HTML.
- `components/providers/ConvexAccessTokenProvider.tsx` ("use client"): pide y renueva el accessToken; lo guarda solo en memoria (estado de React), nunca en `document.cookie` ni localStorage, y nunca intenta tocar la cookie httpOnly de sesión (no podría — es server-only). Corrige el desajuste entre el reloj del dispositivo y el de Convex usando el `serverNow` que devuelve el endpoint, en vez de comparar `expiresAt` directamente contra `Date.now()` local.
- `components/providers/ConvexAuthErrorBoundary.tsx`: captura `UNAUTHENTICATED` en el resto del shell (`Sidebar`, `MobileTopBar`, etc. — fuera de `{children}`, que ya cubre `app/(app)/error.tsx`). Como mucho un intento automático de recuperación por incidente: si el token renovado también falla, navega a `/login` en vez de reintentar indefinidamente.
- `lib/convex/authedHooks.ts` (`useAuthedQuery`/`useAuthedMutation`): inyectan el accessToken vigente en cada llamada; un `"skip"` explícito del consumidor siempre se respeta, con o sin token disponible.
- Dos estados terminales del provider: `SESSION_INVALID`/`NO_SESSION` (la cookie larga ya no vale — el propio Route Handler la borra, navega a `/login`) y `PASSWORD_CHANGE_REQUIRED` (la sesión sigue siendo válida, solo falta completar el cambio de contraseña — la cookie larga se conserva, navega a `/cambiar-contrasena`). Este segundo caso es alcanzable con la app ya abierta si alguien fuerza el cambio de contraseña de la cuenta activa a media sesión.

Funciones públicas de Convex que ahora exigen `token` (accessToken de PRO-59):

- `clients.create`
- `clients.getById`
- `clients.updateStatus`
- `clients.update`
- `followUps.listToday`
- `followUps.upsert`
- `followUps.complete`
- `followUps.discard`
- `followUps.getByClient`
- `notes.create`
- `notes.unfeature`
- `notes.listByClient`
- `sales.listByClient`
- `sales.create`
- `users.create` (PRO-45, además exige `role === "owner"` vía `requireOwner`)
- `users.resetEmployeePassword` (PRO-45, además exige `role === "owner"` vía `requireOwner`)

Además de esta lista, `sessions.login`, `sessions.verify`, `sessions.logout`, `sessions.issueAccessToken` y `users.changePassword` **también** son funciones públicas sin autenticación de Convex (no usan `ctx.auth` — no hay proveedor de identidad configurado). A diferencia de las de arriba, aquí es inevitable por diseño (un login no puede exigir tener ya una sesión, y emitir un accessToken exige el token de sesión largo, no uno de acceso) y cada una impone su propio requisito lógico dentro de la función, no del framework:

- `sessions.login`: exige email y contraseña correctos; sin eso no crea sesión.
- `sessions.verify` / `sessions.logout`: exigen un token de sesión con formato válido y existente (`verify` es de solo lectura; `logout` es idempotente si el token ya no existe).
- `sessions.issueAccessToken`: exige un token de sesión válido y `mustChangePassword: false`; rechaza con `PASSWORD_CHANGE_REQUIRED` si el cambio de contraseña sigue pendiente.
- `users.changePassword`: exige un token de sesión válido **y** la contraseña actual correcta; rota la sesión al terminar (ver arriba).

Ninguna de las cinco es alcanzable "gratis": quien las llame necesita ya sea credenciales válidas, ya sea un token de sesión real — a diferencia de antes de PRO-59, `clients.*`/`notes.*`/`followUps.*`/`sales.*` (y, desde PRO-45, `users.create`/`users.resetEmployeePassword`) tampoco lo son: exigen su propio accessToken (ver arriba).

Además, la autoría de notas/ventas/seguimientos (`authorId`/`authorName`, `assigneeId`/`assigneeName`) se asigna siempre en servidor a partir del usuario autenticado que resuelve `requireAccessToken` — nunca se acepta como argumento del cliente, así que nadie puede elegir firmar como otra persona ni suplantar a otro usuario ya logueado.

## Desarrollo

`CONVEX_DEPLOYMENT=dev:useful-rat-834` (variable local, la usa la CLI) y `NEXT_PUBLIC_CONVEX_URL=https://useful-rat-834.eu-west-1.convex.cloud` (variable de bundle del cliente, mismo valor en Railway) apuntan al **mismo** deployment — no hay un Convex de producción separado del de desarrollo. `npx convex dev` sin `--once` sincroniza en continuo contra ese deployment compartido, así que un cambio a medio terminar puede llegar sin querer a la demo pública de Railway mientras se está programando.

Para trabajar en local, sin tocar el deployment compartido:

```
npm install
npx convex codegen   # solo genera tipos, no toca el deployment
npm run dev           # frontend Next.js
npm test              # vitest
```

Para publicar un cambio (backend + frontend), en este orden:

```
npm test && npm run lint && npm run build   # todo en verde antes de tocar el deployment compartido
npx convex dev --once                        # sincroniza el backend UNA vez, no en continuo
git push origin master                       # Railway construye el frontend a partir de aquí
```

## Aprovisionar una cuenta de usuario (Dueña/Empleado)

Desde PRO-45 existe una pantalla de alta de empleado (`/empleados/nuevo`, `users.create` — solo accesible con `role: "owner"`, sin enlace todavía en ningún menú porque PRO-51/PRO-24 son quienes conectan la navegación). Ese camino solo sirve para que la Dueña dé de alta a un Empleado; no hay forma de crear la propia cuenta inicial de la Dueña desde la web (no tiene sentido: nadie más existe todavía para darla de alta). Para esa cuenta inicial (y para cualquier alta fuera de la web), la única vía sigue siendo la `internalMutation` `users.provisionUser` (`convex/model/users.ts`), invocable solo por CLI — nunca desde el navegador:

```
npx convex run users:provisionUser '{"name":"Marta Gómez","email":"marta@ejemplo.com","password":"...","role":"owner"}'
```

`role` es `"owner"` (Dueña) o `"employee"` (Empleado). La cuenta se crea con `mustChangePassword: true` siempre, así que la contraseña indicada aquí es solo temporal: en el primer login (`/login`), la app lleva directo a `/cambiar-contrasena` y no deja usar el resto del CRM hasta completarlo.

**Cuidado con el historial de shell:** ese comando deja la contraseña en texto plano en el historial local de PowerShell/bash (`argv`, no hay entrada por stdin en `npx convex run`). Esto es un riesgo distinto del ya aceptado arriba para las mutations públicas sobre datos ficticios — aquí es una contraseña real, aunque temporal. Úsalo solo en tu propia máquina y considera borrar esa línea del historial si te preocupa.
