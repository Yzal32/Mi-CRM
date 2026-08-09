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
  })
    .index("by_seedKey", ["seedKey"])
    .index("by_seedData", ["seedData"])
    .index("by_phoneKey", ["phoneKey"]),

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
    // nueva" vive en convex/model/followUps.ts (upsertFollowUp vía
    // convex/model/actor.ts), no aquí — mismo criterio que `clients` con
    // phone/email/etc.
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
    // migración. Denormalizados hasta que exista la entidad Usuario
    // (PRO-43) — ver convex/model/actor.ts. Nunca argumento de mutation
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
    // igualmente porque el servidor los asigna, ver convex/model/actor.ts).
    authorId: v.string(),
    authorName: v.string(),
    seedData: v.optional(v.boolean()),
    seedKey: v.optional(v.string()),
  })
    .index("by_client_date", ["clientId", "date"])
    .index("by_seedKey", ["seedKey"])
    .index("by_seedData", ["seedData"]),
});
