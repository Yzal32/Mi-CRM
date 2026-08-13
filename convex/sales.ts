import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { createSale } from "./model/sales";
import { requireAccessToken } from "./model/auth";

const LIST_LIMIT = 500;

const saleDto = v.object({
  _id: v.id("sales"),
  _creationTime: v.number(),
  clientId: v.id("clients"),
  description: v.string(),
  amountCents: v.number(),
  date: v.string(),
  authorId: v.string(),
  authorName: v.string(),
});

function toSaleDto(sale: Doc<"sales">) {
  return {
    _id: sale._id,
    _creationTime: sale._creationTime,
    clientId: sale.clientId,
    description: sale.description,
    amountCents: sale.amountCents,
    date: sale.date,
    authorId: sale.authorId,
    authorName: sale.authorName,
  };
}

export const listByClient = query({
  args: { token: v.string(), clientId: v.id("clients") },
  returns: v.object({ items: v.array(saleDto), truncated: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAccessToken(ctx, args.token);
    const raw = await ctx.db
      .query("sales")
      .withIndex("by_client_date", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(LIST_LIMIT + 1);
    const truncated = raw.length > LIST_LIMIT;
    const items = raw.slice(0, LIST_LIMIT).map(toSaleDto);
    return { items, truncated };
  },
});

// Nunca acepta authorId/authorName del cliente: el servidor asigna siempre
// la identidad del usuario autenticado, resuelta por requireAccessToken,
// igual que notes.create y followUps.upsert. La fecha tampoco es argumento
// del cliente — createSale la fija siempre con la fecha de negocio del
// servidor (ver convex/model/sales.ts).
export const create = mutation({
  args: { token: v.string(), clientId: v.id("clients"), description: v.string(), amountCents: v.number() },
  returns: v.id("sales"),
  handler: async (ctx, args) => {
    const actor = await requireAccessToken(ctx, args.token);
    return createSale(ctx, {
      clientId: args.clientId,
      description: args.description,
      amountCents: args.amountCents,
      authorId: actor.userId,
      authorName: actor.name,
    });
  },
});
