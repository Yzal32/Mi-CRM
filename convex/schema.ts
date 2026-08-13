import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  clients: defineTable({
    name: v.string(),
    // phone/phoneKey/email/originChannel/status/signupDate son opcionales a
    // nivel de schema para no obligar a los inserts de test preexistentes
    // (followUps.test.ts, upsertFollowUp.test.ts) a declararlos. La
    // invariante real ("siempre poblados en un cliente creado por la app")
    // vive en convex/model/clients.ts (createClient), no aquí — cualquier
    // lectura futura (Ficha, Lista, Estadísticas) debe tratarlos como
    // opcionales en el tipo.
    phone: v.optional(v.string()),
    // Clave canónica solo-dígitos de `phone` (ver lib/shared/normalizePhoneKey.ts),
    // usada para detectar duplicados entre formatos equivalentes.
    phoneKey: v.optional(v.string()),
    email: v.optional(v.string()),
    originChannel: v.optional(
      v.union(
        v.literal("web"),
        v.literal("social"),
        v.literal("email"),
        v.literal("whatsapp"),
        v.literal("referral"),
        v.literal("visit"),
      ),
    ),
    status: v.optional(
      v.union(
        v.literal("new"),
        v.literal("contacted"),
        v.literal("interested"),
        v.literal("won"),
        v.literal("lost"),
      ),
    ),
    // Fecha civil "YYYY-MM-DD" (ver lib/shared/businessDay.ts), generada por
    // createClient con businessDayKey() — nunca viene de un argumento de
    // cliente, ni depende de _creationTime.
    signupDate: v.optional(v.string()),
    // Presentes solo en documentos creados por convex/seed.ts (ver
    // convex/model/followUps.ts y convex/seed.ts). Ninguna función pública
    // acepta estos campos como argumento.
    seedData: v.optional(v.boolean()),
    seedKey: v.optional(v.string()),
    // Proyección de `name` sin diacríticos ni mayúsculas (ver
    // lib/shared/foldDiacritics.ts), mantenida por createClient/updateClient
    // — a diferencia de phoneKey, SÍ requiere backfill para los clientes
    // creados antes de este campo (ver convex/migrations.ts,
    // backfillClientsNameFold), porque no es un campo que ya existiera
    // poblado. Es lo que indexa search_name (abajo), no `name` directamente:
    // así "maria" encuentra "María" y viceversa (PRO-10, feedback de
    // producto — un trabajador que escribe rápido puede no poner la tilde).
    nameFold: v.optional(v.string()),
  })
    .index("by_seedKey", ["seedKey"])
    .index("by_seedData", ["seedData"])
    .index("by_phoneKey", ["phoneKey"])
    // Índice de texto sobre `nameFold`, no sobre `name`: el índice de texto
    // de Convex hace casefolding pero no plegado de diacríticos, así que
    // indexar `name` tal cual dejaba "maria" (sin tilde) sin encontrar
    // "María" — confirmado contra un deployment real, no solo el simulador
    // de tests. Coste de consulta proporcional a los resultados devueltos,
    // no al tamaño de la tabla. Ver convex/clients.ts (search) — el
    // teléfono usa `by_phoneKey` (arriba), no este índice.
    .searchIndex("search_name", { searchField: "nameFold" })
    // Índice REGULAR (no de texto) sobre el mismo campo `nameFold`, para
    // PRO-19 (Lista de clientes): permite leer clientes ya ordenados
    // alfabéticamente (sin diacríticos/mayúsculas) con coste proporcional a
    // los resultados devueltos, nunca al tamaño de la tabla — igual modelo
    // que `by_phoneKey`. `search_name` (arriba) no sirve para esto: un
    // searchIndex solo admite consultas con un término de búsqueda, no un
    // listado ordenado simple. Ver convex/clients.ts (list).
    .index("by_nameFold", ["nameFold"]),

  followUps: defineTable({
    clientId: v.id("clients"),
    // Fecha civil "YYYY-MM-DD" (zona de negocio Europe/Madrid), nunca un
    // timestamp — ver lib/shared/businessDay.ts. Validada con
    // isValidBusinessDayKey antes de escribirse (convex/model/followUps.ts).
    dueDate: v.string(),
    actionType: v.union(
      v.literal("call"),
      v.literal("whatsapp"),
      v.literal("email"),
      v.literal("visit"),
    ),
    // Responsable del próximo contacto (PRO-7/PRO-27), NO "creado por" —
    // opcionales porque la tabla ya tiene documentos reales (dev y Railway
    // comparten deployment) y Convex valida todo documento existente al
    // hacer push del schema; la invariante "siempre poblado en escritura
    // nueva" vive en convex/model/followUps.ts (upsertFollowUp, con el
    // usuario autenticado que resuelve requireAccessToken), no aquí — mismo
    // criterio que `clients` con phone/email/etc.
    assigneeId: v.optional(v.string()),
    assigneeName: v.optional(v.string()),
    seedData: v.optional(v.boolean()),
  })
    .index("by_client", ["clientId"])
    .index("by_dueDate", ["dueDate"])
    .index("by_seedData", ["seedData"]),

  notes: defineTable({
    clientId: v.id("clients"),
    // Fecha civil "YYYY-MM-DD", generada por createNote con businessDayKey()
    // — nunca argumento de la mutation pública, igual que clients.signupDate.
    date: v.string(),
    text: v.string(),
    // Invariante "como mucho una nota destacada por cliente a la vez" vive
    // en convex/model/notes.ts (createNote), nunca aquí.
    featured: v.boolean(),
    // Tabla nueva (cero documentos existentes): a diferencia de
    // followUps.assigneeId, aquí sí pueden ser obligatorios sin problema de
    // migración. Denormalizados del usuario autenticado (requireAccessToken)
    // en vez de una referencia a `users`. Nunca argumento de mutation
    // pública: el servidor los asigna siempre.
    authorId: v.string(),
    authorName: v.string(),
    seedData: v.optional(v.boolean()),
    seedKey: v.optional(v.string()),
  })
    // Listado por cliente ordenado por fecha (más reciente primero vía
    // .order("desc")); también sirve de prefijo para "todas las notas de un
    // cliente" sin fijar `date`.
    .index("by_client_date", ["clientId", "date"])
    // Localiza la nota destacada de un cliente sin escanear el resto —
    // usado por createNote para desmarcar la anterior y por listByClient
    // para resolverla aparte del listado paginado.
    .index("by_client_featured", ["clientId", "featured"])
    .index("by_seedKey", ["seedKey"])
    .index("by_seedData", ["seedData"]),

  users: defineTable({
    name: v.string(),
    // Canónico en minúsculas (igual que clients.email) — identificador de
    // login. Unicidad garantizada en createUser vía by_email, no aquí.
    email: v.string(),
    // Nunca texto plano — ver convex/model/users.ts (bcryptjs).
    passwordHash: v.string(),
    // Reusa los literales ya establecidos en lib/auth/currentUser.ts
    // (CurrentUser.role) para no introducir un segundo vocabulario para el
    // mismo concepto ("Dueña"/"Empleado" en el ticket PRO-43).
    role: v.union(v.literal("owner"), v.literal("employee")),
    status: v.union(v.literal("active"), v.literal("inactive")),
    // Fecha civil "YYYY-MM-DD" vía businessDayKey(), igual criterio que
    // clients.signupDate/notes.date — nunca argumento de mutation pública.
    createdDate: v.string(),
    // true tras un reseteo de contraseña (PRO-45) o un aprovisionamiento
    // inicial (convex/users.ts provisionUser); se pone a false cuando el
    // usuario la cambia desde "Mi cuenta" (PRO-57). Consumido por el login
    // (PRO-44), que redirige al cambio de contraseña antes de dejar entrar.
    mustChangePassword: v.boolean(),
    seedData: v.optional(v.boolean()),
    seedKey: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_seedKey", ["seedKey"])
    .index("by_seedData", ["seedData"]),

  sessions: defineTable({
    userId: v.id("users"),
    // SHA-256 hex del token de sesión — el token en claro nunca se
    // persiste (ver convex/model/sessions.ts). Un volcado de esta tabla no
    // basta para secuestrar una sesión.
    tokenHash: v.string(),
    // Fecha civil "YYYY-MM-DD" vía businessDayKey(), solo para auditoría —
    // esta tabla no expira sesiones por fecha (ver MAX_SESSIONS_PER_USER en
    // convex/model/sessions.ts para el único límite que sí se aplica).
    createdDate: v.string(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId", ["userId"]),

  // PRO-59: tokens de acceso de corta duración para autenticar las llamadas
  // en vivo de convex/react (clients.*/notes.*/followUps.*/sales.listByClient),
  // derivados de una sesión ya validada — ver convex/model/sessions.ts
  // (issueAccessToken/verifyAccessToken). Tabla independiente de `sessions`,
  // no un campo en ella: varias pestañas/refrescos pueden tener cada una su
  // propio accessToken vigente sin invalidarse entre sí.
  accessTokens: defineTable({
    sessionId: v.id("sessions"),
    // Mismo criterio que sessions.tokenHash: SHA-256 hex, el token en claro
    // nunca se persiste.
    tokenHash: v.string(),
    // Epoch ms (a diferencia de createdDate/date, que son fechas civiles en
    // el resto de este schema) — issueAccessToken lo compara con Date.now().
    expiresAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_sessionId", ["sessionId"]),

  sales: defineTable({
    clientId: v.id("clients"),
    description: v.string(),
    // Importe en céntimos de euro, entero — evita errores de redondeo de
    // coma flotante en JS. Ver convex/model/sales.ts.
    amountCents: v.number(),
    // Fecha civil "YYYY-MM-DD", generada por createSale igual que notes.date.
    date: v.string(),
    // Tabla nueva: obligatorios sin problema de migración (recomendado por
    // PRO-8/PRO-27, no bloqueante para el MVP en sí — se rellenan siempre
    // igualmente porque el servidor los asigna a partir del usuario
    // autenticado, ver requireAccessToken en convex/model/auth.ts).
    authorId: v.string(),
    authorName: v.string(),
    seedData: v.optional(v.boolean()),
    seedKey: v.optional(v.string()),
  })
    .index("by_client_date", ["clientId", "date"])
    .index("by_seedKey", ["seedKey"])
    .index("by_seedData", ["seedData"]),
});
