import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { calendarDayDiff, isValidBusinessDayKey } from "../lib/shared/businessDay";
import { getActor } from "./model/actor";
import { completeFollowUp, discardFollowUp, upsertFollowUp } from "./model/followUps";

// Tope documentado por rango (atrasados / de hoy), cada uno con su propio
// límite independiente — así un backlog grande de atrasados nunca puede
// "comerse" los seguimientos de hoy (ver plan: son consultas separadas).
// Holgado para el tamaño de negocio objetivo del MVP; superarlo de forma
// habitual es señal de que hace falta paginación real (tarea aparte).
export const LIMIT = 300;

const actionTypeValidator = v.union(v.literal("call"), v.literal("whatsapp"), v.literal("email"), v.literal("visit"));

const followUpItem = v.object({
  followUpId: v.id("followUps"),
  clientId: v.id("clients"),
  clientName: v.string(),
  actionType: actionTypeValidator,
  diffDays: v.number(),
});

export const listToday = query({
  args: {
    today: v.string(),
    search: v.optional(v.string()),
  },
  returns: v.object({
    overdue: v.array(followUpItem),
    overdueTruncated: v.boolean(),
    today: v.array(followUpItem),
    todayTruncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (!isValidBusinessDayKey(args.today)) {
      throw new Error(`today inválida: "${args.today}"`);
    }
    const term = (args.search ?? "").trim().toLowerCase().slice(0, 100);

    const overdueRaw = await ctx.db
      .query("followUps")
      .withIndex("by_dueDate", (q) => q.lt("dueDate", args.today))
      .take(LIMIT + 1);
    const overdueTruncated = overdueRaw.length > LIMIT;
    const overdueRows = overdueRaw.slice(0, LIMIT);

    const todayRaw = await ctx.db
      .query("followUps")
      .withIndex("by_dueDate", (q) => q.eq("dueDate", args.today))
      .take(LIMIT + 1);
    const todayTruncated = todayRaw.length > LIMIT;
    const todayRows = todayRaw.slice(0, LIMIT);

    const buildGroup = async (rows: typeof overdueRows) => {
      const items: Array<{
        followUpId: (typeof rows)[number]["_id"];
        clientId: (typeof rows)[number]["clientId"];
        clientName: string;
        actionType: (typeof rows)[number]["actionType"];
        diffDays: number;
      }> = [];
      for (const row of rows) {
        // Referencia huérfana defensiva: si en el futuro se construye
        // "eliminar cliente" (fuera de alcance), esa mutation deberá borrar
        // en cascada vía el índice by_client; hasta entonces, un huérfano
        // simplemente no aparece aquí, no rompe la pantalla.
        const client = await ctx.db.get(row.clientId);
        if (!client) continue;
        if (term && !client.name.toLowerCase().includes(term)) continue;
        items.push({
          followUpId: row._id,
          clientId: client._id,
          clientName: client.name,
          actionType: row.actionType,
          diffDays: calendarDayDiff(row.dueDate, args.today),
        });
      }
      return items;
    };

    return {
      overdue: await buildGroup(overdueRows),
      overdueTruncated,
      today: await buildGroup(todayRows),
      todayTruncated,
    };
  },
});

const followUpDto = v.object({
  _id: v.id("followUps"),
  _creationTime: v.number(),
  clientId: v.id("clients"),
  dueDate: v.string(),
  actionType: actionTypeValidator,
  assigneeId: v.optional(v.string()),
  assigneeName: v.optional(v.string()),
});

function toFollowUpDto(row: Doc<"followUps">) {
  return {
    _id: row._id,
    _creationTime: row._creationTime,
    clientId: row.clientId,
    dueDate: row.dueDate,
    actionType: row.actionType,
    assigneeId: row.assigneeId,
    assigneeName: row.assigneeName,
  };
}

// El seguimiento pendiente de un cliente, o null si no tiene ninguno. Sin
// .unique(): upsertFollowUp reconoce que pueden existir duplicados
// transitorios y los repara en la siguiente escritura — .unique() lanzaría
// si esta query cae justo en ese instante. Se elige el más reciente por
// _creationTime, mismo criterio de desempate que usa upsertFollowUp.
export const getByClient = query({
  args: { clientId: v.id("clients") },
  returns: v.union(followUpDto, v.null()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("followUps")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    if (rows.length === 0) return null;
    const mostRecent = rows.reduce((a, b) => (b._creationTime > a._creationTime ? b : a));
    return toFollowUpDto(mostRecent);
  },
});

// Nunca acepta assigneeId/assigneeName ni seedData del cliente: el servidor
// asigna siempre la identidad de demostración (convex/model/actor.ts).
// seedData solo lo usa convex/seed.ts, llamando a upsertFollowUp
// directamente (no a esta mutation pública).
export const upsert = mutation({
  args: {
    clientId: v.id("clients"),
    dueDate: v.string(),
    actionType: actionTypeValidator,
  },
  returns: v.id("followUps"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx);
    return upsertFollowUp(ctx, { ...args, assigneeId: actor.id, assigneeName: actor.name });
  },
});

export const complete = mutation({
  args: { followUpId: v.id("followUps") },
  returns: v.id("notes"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx);
    return completeFollowUp(ctx, { followUpId: args.followUpId, authorId: actor.id, authorName: actor.name });
  },
});

export const discard = mutation({
  args: { followUpId: v.id("followUps") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await discardFollowUp(ctx, args);
    return null;
  },
});
