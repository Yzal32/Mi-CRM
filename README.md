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

Además de esta lista, `sessions.login`, `sessions.verify`, `sessions.logout`, `sessions.issueAccessToken`, `users.changePassword` y `sessions.loginWithGoogle` **también** son funciones públicas sin autenticación de Convex (no usan `ctx.auth` — no hay proveedor de identidad configurado). A diferencia de las de arriba, aquí es inevitable por diseño (un login no puede exigir tener ya una sesión, y emitir un accessToken exige el token de sesión largo, no uno de acceso) y cada una impone su propio requisito lógico dentro de la función, no del framework:

- `sessions.login`: exige email y contraseña correctos; sin eso no crea sesión.
- `sessions.verify` / `sessions.logout`: exigen un token de sesión con formato válido y existente (`verify` es de solo lectura; `logout` es idempotente si el token ya no existe).
- `sessions.issueAccessToken`: exige un token de sesión válido y `mustChangePassword: false`; rechaza con `PASSWORD_CHANGE_REQUIRED` si el cambio de contraseña sigue pendiente.
- `users.changePassword`: exige un token de sesión válido **y** la contraseña actual correcta; rota la sesión al terminar (ver arriba).
- `sessions.loginWithGoogle` (PRO-63, `action`): exige un `code` de OAuth que solo canjea correctamente con `GOOGLE_CLIENT_SECRET` (nunca visible fuera de Convex) **y** que el email verificado por Google corresponda a un usuario ya aprovisionado y activo — ver "Cómo funciona el login con Google" más abajo.

Ninguna de las seis es alcanzable "gratis": quien las llame necesita ya sea credenciales válidas, ya sea un token de sesión real, ya sea un `code` real de Google — a diferencia de antes de PRO-59, `clients.*`/`notes.*`/`followUps.*`/`sales.*` (y, desde PRO-45, `users.create`/`users.resetEmployeePassword`) tampoco lo son: exigen su propio accessToken (ver arriba).

Además, la autoría de notas/ventas/seguimientos (`authorId`/`authorName`, `assigneeId`/`assigneeName`) se asigna siempre en servidor a partir del usuario autenticado que resuelve `requireAccessToken` — nunca se acepta como argumento del cliente, así que nadie puede elegir firmar como otra persona ni suplantar a otro usuario ya logueado.

Del lado de Next.js (no solo Convex), cada página restringida a la Dueña comprueba `user.role` en el propio server component y renderiza `<UnauthorizedScreen />` (`components/shared/UnauthorizedScreen.tsx`, PRO-46) en su lugar si no cumple — patrón usado hoy en `/empleados/nuevo`. `app/(app)/layout.tsx` solo valida que haya sesión, no rol: el guard de rol es responsabilidad de cada página.

### Cómo funciona el login con Google (PRO-63)

Convive con el login por email+contraseña, sin sustituirlo. El registro sigue cerrado por diseño: Google nunca puede crear una cuenta, solo iniciar sesión en una ya aprovisionada (`users.create`/`provisionUser`) y activa — vincula únicamente por email, sin campo `googleSub` en `users` (decisión consciente dado el tamaño del equipo: 2 cuentas reales, aprovisionamiento manual por la Dueña).

- `app/api/auth/google/start/route.ts` → `app/api/auth/google/callback/route.ts`: flujo OAuth2 estándar. `/start` genera un `state` anti-CSRF (cookie httpOnly de 10 min, `google_oauth_state`) y redirige a Google; `/callback` valida ese `state` contra la cookie antes de continuar. `proxy.ts` excluye ambas rutas exactas de su redirección a `/login` — son precisamente las que un usuario **sin sesión** necesita alcanzar.
- `sessions.loginWithGoogle` (Convex `action`, la primera del proyecto — solo una `action` puede hacer `fetch` saliente): canjea el `code` por un `access_token` con Google (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, variables de entorno de **Convex**, nunca de Next.js/Railway) y confirma el email vía el endpoint `userinfo` de Google (`email_verified === true`), en vez de verificar la firma del `id_token` a mano. Solo con ese email verificado llama a `internal.sessions.loginWithGoogleEmail` (`internalMutation`, no pública — inalcanzable sin pasar por la action) para crear la sesión.
- `components/ui/Button.tsx` acepta un `prefetch` opcional; el CTA "Continuar con Google" usa `prefetch={false}` porque `/api/auth/google/start` tiene efecto lateral real (fija la cookie de estado y redirige) — sin eso, `next/link` lo dispararía en segundo plano solo por estar en viewport/hover.
- **Riesgo aceptado, distinto del de `sessions.login`:** `loginWithGoogle` no tiene rate-limiting y es alcanzable directamente con cualquier cliente Convex (sin pasar por `/start`), aunque un `code` inventado simplemente falla el canje con Google sin crear sesión. El coste es asimétrico (una petición barata dispara 2 `fetch` nuestros hacia Google), con riesgo de que Google limite el `client_id` por tráfico anómalo — aceptado explícitamente para el tamaño actual del equipo, sin mitigación en esta tarea.
- **Variables de entorno:** `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` en Convex (`npx convex env set ...`, contra el deployment compartido) y `GOOGLE_CLIENT_ID`/`APP_URL` (sin `NEXT_PUBLIC_`, variables de servidor normal) en Railway/`.env.local` — el secreto nunca sale de Convex. Redirect URI registrada en Google Cloud Console: `https://mi-crm-production-d80f.up.railway.app/api/auth/google/callback` (producción) y `http://localhost:3000/api/auth/google/callback` (desarrollo local).
- **`APP_URL` (PRO-65), no `request.url`:** `lib/auth/googleRedirectUri.ts` construye la `redirect_uri` y las redirecciones de éxito/error de estas dos rutas a partir de `APP_URL`, nunca de `request.url` — en el despliegue de Railway, el `Host` que ve la Route Handler dentro del contenedor no es el dominio público (comprobado: resolvía a `http://localhost:8080/...`), lo que causaba `redirect_uri_mismatch` en Google. `APP_URL` en Railway es `https://mi-crm-production-d80f.up.railway.app`.

### Cómo funciona el envío de emails (PRO-66)

Todavía en **modo prueba (sandbox)**: el CRM vive en el subdominio gratuito de Railway (`mi-crm-production-d80f.up.railway.app`), que no admite verificación DNS porque no lo controla el usuario, así que no hay dominio propio verificado en Resend.

- `convex/model/email.ts` (`sendEmail`): capa reutilizable, agnóstica del remitente — llama a la API REST de Resend (`https://api.resend.com/emails`) vía `fetch`, sin añadir el SDK `resend` como dependencia (mismo criterio que Google OAuth). Pensada para que features futuras del CRM la reutilicen (p. ej. notificar a un empleado, PRO-51) sin tocarla cuando exista un dominio propio.
- `convex/email.ts` (`sendTestEmail`, `internalAction`, la primera `internalAction` del proyecto): vía manual de verificación, sin UI. Usa como remitente `onboarding@resend.dev` — en sandbox, Resend solo entrega a la dirección con la que está registrada la cuenta. Se invoca por CLI: `npx convex run email:sendTestEmail '{"to":"tu-email@ejemplo.com"}'`.
- **`RESEND_API_KEY`** es variable de entorno de **Convex** (nunca de `.env.local`/Railway): se configura desde el dashboard de Convex o con `npx convex env set RESEND_API_KEY ...` en tu propia terminal.
- **Importante antes de probar:** `npx convex run` ejecuta la función tal como está **desplegada** en el deployment compartido (`dev:useful-rat-834`), no el código local — asegúrate de que `npx convex dev` (o `npx convex dev --once`) ya sincronizó tus cambios antes de invocar `sendTestEmail`, o estarás probando una revisión anterior.
- Cuando exista un dominio propio verificado, hay que cambiar `SANDBOX_FROM_ADDRESS` en `convex/email.ts` (y, para uso real, mover el remitente a donde lo necesite cada feature) — fuera de alcance de PRO-66.

### Cómo funciona la recuperación de contraseña (PRO-67, código desde PRO-68)

Tercer flujo de contraseña, distinto de `users.changePassword` (usuario ya logueado, PRO-57) y `users.resetEmployeePassword` (lo hace la Dueña sobre un empleado, PRO-45): aquí el usuario no tiene sesión y demuestra su identidad poseyendo un código de un solo uso enviado a su email registrado.

- `app/recuperar-contrasena` (pide el código, un solo campo: email) → `app/restablecer-contrasena` (email + código de 6 dígitos + contraseña nueva + confirmación — ruta **estática**, ya no lleva ningún secreto en la URL, a diferencia del enlace de PRO-67). Ambas rutas están excluidas de la redirección a `/login` en `proxy.ts` — igual que `/login` y las de Google, un usuario **sin sesión** es precisamente quien necesita alcanzarlas.
- `passwordReset.requestPasswordReset` (Convex `action` pública): genera el código vía `internal.passwordReset.createResetForEmail` (`internalMutation`) y, si existe una cuenta activa con ese email, envía el correo con `internal.email.sendPasswordResetEmail`. Responde siempre igual (sin error) exista o no la cuenta — mismo criterio de no revelar cuentas que `sessions.login`.
- **Un código de 6 dígitos (1.000.000 de combinaciones) es un secreto mucho más débil que el token de 256 bits del enlace de PRO-67**, así que hacen falta varios controles para que sea seguro (ver `convex/model/passwordReset.ts`):
  - Máximo `MAX_CODE_ATTEMPTS = 5` intentos fallidos por código; al agotarlos, la fila **no se borra** — queda marcada como agotada (sigue rechazando incluso el código correcto) durante lo que reste de `MIN_REQUEST_INTERVAL_MS`, en vez de comportarse como "un código más" todavía utilizable.
  - `MIN_REQUEST_INTERVAL_MS = 1 minuto` entre solicitudes de código por usuario — sin esto, el límite de intentos no protegería nada (bastaría con pedir un código nuevo cada vez que se agoten los 5 intentos).
  - `PASSWORD_RESET_CODE_TTL_MS = 15 minutos` (antes 1 hora del enlace) — un código pensado para teclearse en el momento no necesita esa ventana.
  - Como mucho un código activo por usuario a la vez.
  - **`codeHash` es HMAC-SHA256 con un secreto propio del servidor (`PASSWORD_RESET_CODE_PEPPER`), no un hash simple** — con solo 1.000.000 de códigos posibles, `SHA-256(código)` a secas se invertiría offline en milisegundos con solo leer la tabla `passwordResets`, saltándose todos los controles anteriores (que solo protegen la vía online, contra la mutation pública). El pepper es variable de entorno de **Convex**, nunca se guarda en la base de datos: `npx convex env set PASSWORD_RESET_CODE_PEPPER "$(openssl rand -hex 32)"`. Sin él configurado, `requestPasswordReset`/`resetPassword` fallan en cerrado.
  - `passwordReset.resetPassword` es una `action` (no una `mutation`): orquesta dos `internalMutation` independientes (`verifyResetCode` + `applyNewPassword`) porque Convex revierte **todos** los writes de una mutation que lanza una excepción — si verificar e incrementar `attempts` estuvieran en la misma mutation que finalmente falla, ese incremento nunca llegaría a persistir. `verifyResetCode` se comita siempre (haya acertado o no), y solo si acierta la action continúa con `applyNewPassword`.
- `users.resetPasswordAfterVerification` (renombrada desde `resetPasswordWithToken` de PRO-67) rota las sesiones del usuario (igual que `changePassword`) y borra todos los códigos de recuperación pendientes de esa cuenta, no solo el usado.
- **No auto-inicia sesión** (a diferencia de `changePassword`): tras restablecer, redirige a `/login?passwordReset=1` para entrar con la contraseña nueva — no se crea una sesión a partir de una prueba más débil (posesión del email) que un login real.
- **Riesgos aceptados** (documentados explícitamente en la auditoría, sin mitigación en esta tarea): más allá de los 5 controles de arriba, no hay CAPTCHA ni bloqueo de cuenta; sin rate-limiting adicional por origen; a diferencia de `login` (que usa `DUMMY_HASH` para tiempo constante), `requestPasswordReset` sí tiene una diferencia de tiempo observable entre "el email existe" (hace un `fetch` real a Resend) y "no existe" (retorno inmediato); la comparación del HMAC no es en tiempo constante.
- Sigue en modo sandbox (ver sección de PRO-66 arriba): mientras no exista un dominio propio verificado, el correo solo llega a la dirección con la que está registrada la cuenta de Resend.

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

Para corregir el email de una cuenta ya existente (no hay pantalla de edición, solo alta) existe, mismo patrón, la `internalMutation` `users.updateEmail` (PRO-64) — reutiliza la misma validación de email que `provisionUser`/`users.create` (formato, unicidad vía `by_email`):

```
npx convex run users:updateEmail '{"userId":"...","email":"nuevo@ejemplo.com"}'
```
