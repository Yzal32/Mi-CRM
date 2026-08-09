# Loop CRM

CRM para un negocio pequeño (Marta, la dueña, y Carlos, su empleado), construido con Next.js 16 + Convex.

## Seguridad: sin autenticación todavía

No existe login real (PRO-44 pendiente en Linear). **Todas** las mutations y queries públicas de Convex son accesibles sin autenticación por cualquiera que tenga la URL del deployment — riesgo aceptado explícitamente mientras el deployment solo contenga datos ficticios (ver `convex/seed.ts`). En cuanto haya datos reales de clientes, esto deja de ser aceptable y bloquea cualquier uso hasta que exista login real.

Superficie pública sin autenticación:

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

Todavía no hay pantalla de alta de empleado (PRO-45) ni login (PRO-44). Mientras tanto, la única forma de crear una cuenta (`convex/model/users.ts`) es la `internalMutation` `users.provisionUser`, invocable solo por CLI — nunca desde el navegador:

```
npx convex run users:provisionUser '{"name":"Marta Gómez","email":"marta@ejemplo.com","password":"...","role":"owner"}'
```

`role` es `"owner"` (Dueña) o `"employee"` (Empleado). La cuenta se crea con `mustChangePassword: true` siempre, así que la contraseña indicada aquí es solo temporal.

**Cuidado con el historial de shell:** ese comando deja la contraseña en texto plano en el historial local de PowerShell/bash (`argv`, no hay entrada por stdin en `npx convex run`). Esto es un riesgo distinto del ya aceptado arriba para las mutations públicas sobre datos ficticios — aquí es una contraseña real, aunque temporal. Úsalo solo en tu propia máquina y considera borrar esa línea del historial si te preocupa.
