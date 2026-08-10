import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { createClient, updateClient, updateClientStatus } from "./model/clients";
import { requireAccessToken } from "./model/auth";

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

// PRO-59: exige un accessToken vigente (ver convex/model/auth.ts) — ya no
// alcanzable "gratis" con solo la URL del deployment, ver README.md.
export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    originChannel: v.optional(originChannelValidator),
    status: v.optional(statusValidator),
  },
  returns: v.id("clients"),
  handler: async (ctx, args) => {
    await requireAccessToken(ctx, args.token);
    return createClient(ctx, args);
  },
});

// clientId llega como string plano (la ruta de Next.js entrega un string,
// no un Id<"clients">): normalizeId devuelve null tanto si el string tiene
// un formato inválido como si no corresponde a ningún documento — en
// ambos casos se trata igual, como "cliente no encontrado", sin reventar
// el validador de un v.id("clients") con un ID malformado.
export const getById = query({
  args: { token: v.string(), clientId: v.string() },
  returns: v.union(clientDto, v.null()),
  handler: async (ctx, args) => {
    await requireAccessToken(ctx, args.token);
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

export const updateStatus = mutation({
  args: { token: v.string(), clientId: v.id("clients"), status: statusValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAccessToken(ctx, args.token);
    await updateClientStatus(ctx, args);
    return null;
  },
});

// `name` es v.optional aquí (a diferencia de `create`, donde es
// obligatorio): en la edición, "no enviarlo" es una opción legítima que
// significa "no tocar este campo", no un olvido.
export const update = mutation({
  args: {
    token: v.string(),
    clientId: v.id("clients"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    originChannel: v.optional(originChannelValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAccessToken(ctx, args.token);
    await updateClient(ctx, args);
    return null;
  },
});
