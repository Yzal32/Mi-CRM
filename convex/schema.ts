import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  clients: defineTable({
    name: v.string(),
    // Presentes solo en documentos creados por convex/seed.ts (ver
    // convex/model/followUps.ts y convex/seed.ts). Ninguna función pública
    // acepta estos campos como argumento.
    seedData: v.optional(v.boolean()),
    seedKey: v.optional(v.string()),
  })
    .index("by_seedKey", ["seedKey"])
    .index("by_seedData", ["seedData"]),

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
