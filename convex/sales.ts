import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
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

// Deliberadamente de solo lectura: no hay mutation pública de creación de
// ventas aquí (ver convex/model/sales.ts) — el registro de ventas real es
// PRO-17/23, fuera de alcance de esta tarea.
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
