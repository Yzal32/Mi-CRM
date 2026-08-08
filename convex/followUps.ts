import { v } from "convex/values";
import { query } from "./_generated/server";
import { calendarDayDiff, isValidBusinessDayKey } from "../lib/shared/businessDay";

// Tope documentado por rango (atrasados / de hoy), cada uno con su propio
// límite independiente — así un backlog grande de atrasados nunca puede
// "comerse" los seguimientos de hoy (ver plan: son consultas separadas).
// Holgado para el tamaño de negocio objetivo del MVP; superarlo de forma
// habitual es señal de que hace falta paginación real (tarea aparte).
export const LIMIT = 300;

const followUpItem = v.object({
  followUpId: v.id("followUps"),
  clientId: v.id("clients"),
  clientName: v.string(),
  actionType: v.union(v.literal("call"), v.literal("whatsapp"), v.literal("email"), v.literal("visit")),
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
