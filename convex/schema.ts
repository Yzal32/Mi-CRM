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
    seedData: v.optional(v.boolean()),
  })
    .index("by_client", ["clientId"])
    .index("by_dueDate", ["dueDate"])
    .index("by_seedData", ["seedData"]),
});
