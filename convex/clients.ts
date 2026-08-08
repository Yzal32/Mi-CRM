import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { createClient } from "./model/clients";

// Primera mutation pública del proyecto: sin login real todavía (PRO-44),
// cualquiera con la URL de Convex podría llamarla. Riesgo aceptado
// explícitamente para este deployment de demostración con datos ficticios
// — ver plan de PRO-9 y README.md. Sin seedData/seedKey en el validador,
// igual que internal.seed.seed: solo convex/seed.ts los usa, vía el helper.
export const create = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
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
  },
  returns: v.id("clients"),
  handler: async (ctx, args) => createClient(ctx, args),
});
