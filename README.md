# Loop CRM

CRM para un negocio pequeño (Marta, la dueña, y Carlos, su empleado), construido con Next.js 16 + Convex.

## Seguridad: hay login real, pero las funciones de Convex siguen sin autenticar

Desde PRO-44 existe login real: email + contraseña, sesión con cookie httpOnly (`session_token`), verificada en `app/(app)/layout.tsx` antes de dejar entrar a cualquier pantalla del CRM (`proxy.ts` solo hace un check optimista de que la cookie exista, sin tocar Convex — la comprobación real vive en el layout, ver `lib/auth/session.ts`).

**Importante: esto es una puerta de navegación de Next.js, no autenticación de las funciones de Convex.** `clients.*`, `notes.*`, `followUps.*` y el resto de la superficie listada abajo siguen siendo alcanzables directamente por cualquiera que tenga la URL del deployment y el nombre de la función — con o sin sesión iniciada en la web. La cookie de sesión es httpOnly a propósito (para que un XSS no pueda robarla), lo que significa que el JavaScript del navegador no puede leerla, así que esas funciones —llamadas hoy directamente desde componentes cliente por WebSocket— no tienen ninguna vía para comprobarla. Cerrar ese hueco es una tarea aparte, **PRO-59**, bloqueada por PRO-44 y bloqueante a su vez de meter datos reales de clientes en el deployment — el riesgo que ya aceptaba esta sección mientras los datos sean ficticios (ver `convex/seed.ts`) sigue exactamente igual, sin cambios.

### Cómo funciona la sesión

- `convex/model/sessions.ts`: token opaco de 32 bytes (`crypto.getRandomValues`), guardado como `tokenHash` (SHA-256, `crypto.subtle.digest`) — el token en claro nunca se persiste, solo viaja una vez en la respuesta del login y en la cookie httpOnly.
- Máximo `MAX_SESSIONS_PER_USER = 5` sesiones activas por usuario: al hacer un sexto login, se revoca automáticamente la más antigua. Excepción deliberada a "la sesión se mantiene hasta cierre explícito" — documentada aquí para que no se lea como un bug.
- Cambiar la contraseña (`users.changePassword`, obligatorio tras aprovisionar o voluntario desde Ajustes) **rota** la sesión: cierra todas las sesiones del usuario, incluida la que hizo el cambio, y crea una nueva — si alguien había copiado la cookie con la contraseña antigua, deja de servirle. La cookie del navegador que hizo el cambio se sustituye en la misma respuesta, sin pedir volver a iniciar sesión.
- Sin rate-limiting de intentos de login — riesgo aceptado explícitamente, herramienta interna sin usuarios públicos.

Superficie pública sin autenticación (sin cambios por PRO-44 — ver aviso arriba):

- `clients.create`
- `clients.getById`
- `clients.updateStatus`
- `clients.update` (edición de datos del cliente — endpoint nuevo bajo el mismo riesgo ya aceptado arriba)
- `followUps.listToday`
- `followUps.upsert`
- `followUps.complete`
- `followUps.discard`
- `followUps.getByClient`
- `notes.create`
- `notes.unfeature`
- `notes.listByClient`
- `sales.listByClient` (solo lectura — no existe una mutation pública de creación de ventas)

Además, la autoría de notas/ventas/seguimientos (`authorId`/`authorName`, `assigneeId`/`assigneeName`) es una **identidad de demostración fija** (`convex/model/actor.ts`, "Marta") asignada siempre en servidor — nunca se acepta como argumento del cliente, así que nadie puede elegir firmar como otra persona, pero tampoco es autenticación real: todo queda atribuido a esa misma identidad fija sea quien sea quien lo creó de verdad. No es autoría fiable con datos reales.

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

Todavía no hay pantalla de alta de empleado (PRO-45). Mientras tanto, la única forma de crear una cuenta (`convex/model/users.ts`) es la `internalMutation` `users.provisionUser`, invocable solo por CLI — nunca desde el navegador:

```
npx convex run users:provisionUser '{"name":"Marta Gómez","email":"marta@ejemplo.com","password":"...","role":"owner"}'
```

`role` es `"owner"` (Dueña) o `"employee"` (Empleado). La cuenta se crea con `mustChangePassword: true` siempre, así que la contraseña indicada aquí es solo temporal: en el primer login (`/login`), la app lleva directo a `/cambiar-contrasena` y no deja usar el resto del CRM hasta completarlo.

**Cuidado con el historial de shell:** ese comando deja la contraseña en texto plano en el historial local de PowerShell/bash (`argv`, no hay entrada por stdin en `npx convex run`). Esto es un riesgo distinto del ya aceptado arriba para las mutations públicas sobre datos ficticios — aquí es una contraseña real, aunque temporal. Úsalo solo en tu propia máquina y considera borrar esa línea del historial si te preocupa.
