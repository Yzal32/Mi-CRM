import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { createClient, updateClientStatus } from "./model/clients";

const originChannelValidator = v.union(
  v.literal("web"),
  v.literal("social"),
  v.literal("email"),
  v.literal("whatsapp"),
  v.literal("referral"),
  v.literal("visit"),
);

const statusValidator = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("interested"),
  v.literal("won"),
  v.literal("lost"),
);

const clientDto = v.object({
  _id: v.id("clients"),
  _creationTime: v.number(),
  name: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  originChannel: v.optional(originChannelValidator),
  status: v.optional(statusValidator),
  signupDate: v.optional(v.string()),
});

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
    originChannel: v.optional(originChannelValidator),
    status: v.optional(statusValidator),
  },
  returns: v.id("clients"),
  handler: async (ctx, args) => createClient(ctx, args),
});

// clientId llega como string plano (la ruta de Next.js entrega un string,
// no un Id<"clients">): normalizeId devuelve null tanto si el string tiene
// un formato inválido como si no corresponde a ningún documento — en
// ambos casos se trata igual, como "cliente no encontrado", sin reventar
// el validador de un v.id("clients") con un ID malformado.
export const getById = query({
  args: { clientId: v.string() },
  returns: v.union(clientDto, v.null()),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("clients", args.clientId);
    if (!id) return null;
    const client = await ctx.db.get(id);
    if (!client) return null;
    return {
      _id: client._id,
      _creationTime: client._creationTime,
      name: client.name,
      phone: client.phone,
      email: client.email,
      originChannel: client.originChannel,
      status: client.status,
      signupDate: client.signupDate,
    };
  },
});

// Mismo riesgo aceptado que `create`: sin autenticación todavía (ver README).
export const updateStatus = mutation({
  args: { clientId: v.id("clients"), status: statusValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await updateClientStatus(ctx, args);
    return null;
  },
});
