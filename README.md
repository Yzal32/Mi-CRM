# Loop — CRM

CRM simple para negocios pequeños (Next.js 16 + Convex). Ver `AGENTS.md` antes de tocar código: este proyecto usa una versión de Next.js con cambios importantes respecto al training del modelo.

## Desarrollo local

```bash
npm install
npx convex dev   # primera vez: pide login y rellena .env.local
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La pantalla de inicio ("Hoy") necesita datos de prueba:

```bash
npx convex run seed:seed        # siembra clientes y seguimientos de ejemplo
npx convex run seed:clearSeed   # borra solo lo sembrado
```

No hay login real todavía (ver `lib/auth/currentUser.ts`) — es una decisión de alcance documentada, no un olvido.

## Comprobaciones

```bash
npm run lint
npm run test    # vitest — lógica pura + convex-test
npm run build
```

## Despliegue (Railway)

El repositorio incluye `railway.json` con el build/start command explícitos para que Railway lo trate como una app Node/Next.js (no como sitio estático).

Variables de entorno que hay que configurar en el servicio de Railway (no viven en el repo):

- `NEXT_PUBLIC_CONVEX_URL` — URL del deployment de Convex contra el que debe hablar la app. **Se inyecta en el bundle del cliente en tiempo de build**, así que tiene que estar puesta en Railway antes de la primera build, no solo en runtime.

**Recordatorio de alcance:** mientras no exista login real (tarea PRO-44 en Linear), esta app solo debe usarse con un deployment de Convex de datos ficticios (el del `seed.ts`), nunca con datos reales de clientes — `listToday` no tiene ninguna protección de autorización todavía.
