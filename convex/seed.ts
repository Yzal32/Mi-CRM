import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { businessDayKey } from "../lib/shared/businessDay";
import { upsertFollowUp } from "./model/followUps";
import type { ActionType } from "./model/followUps";

/**
 * `seed` y `clearSeed` son `internalMutation`: solo se pueden invocar desde
 * la CLI (`npx convex run seed:seed`) o desde otras funciones del servidor,
 * nunca desde el navegador. Ver plan, sección "Seguridad y modelo de
 * datos" — esto solo debe ejecutarse contra un deployment de desarrollo con
 * datos ficticios.
 */

function shiftDayKey(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) + deltaDays * 24 * 60 * 60 * 1000;
  return businessDayKey(new Date(ms), "UTC");
}

type Fixture = {
  seedKey: string;
  name: string;
  followUp?: { actionType: ActionType; dueDateOffset: number };
};

// dueDateOffset se resuelve contra el "hoy" del momento en que se ejecuta el
// seed (días relativos), no fechas fijas — así los datos de prueba siguen
// siendo correctos (atrasados/hoy/futuro) sin importar cuándo se siembre.
const FIXTURES: Fixture[] = [
  { seedKey: "seed:carlos-ruiz", name: "Carlos Ruiz", followUp: { actionType: "call", dueDateOffset: -1 } },
  { seedKey: "seed:ana-torres", name: "Ana Torres", followUp: { actionType: "whatsapp", dueDateOffset: -3 } },
  { seedKey: "seed:maria-lopez", name: "María López", followUp: { actionType: "call", dueDateOffset: 0 } },
  { seedKey: "seed:marta-gomez", name: "Marta Gómez", followUp: { actionType: "visit", dueDateOffset: 0 } },
  { seedKey: "seed:javier-soto", name: "Javier Soto", followUp: { actionType: "email", dueDateOffset: 0 } },
  { seedKey: "seed:lucia-fernandez", name: "Lucía Fernández" }, // sin seguimiento: no debe aparecer en Hoy
  { seedKey: "seed:diego-alonso", name: "Diego Alonso", followUp: { actionType: "call", dueDateOffset: 1 } }, // futuro: excluido de Hoy
];

export const seed = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const today = businessDayKey(new Date());

    for (const fixture of FIXTURES) {
      // Identificado por seedKey estable, NUNCA por name: evita reutilizar o
      // contaminar un cliente creado manualmente con el mismo nombre, y hace
      // el seed idempotente (re-ejecutarlo no duplica nada).
      const existingClient = await ctx.db
        .query("clients")
        .withIndex("by_seedKey", (q) => q.eq("seedKey", fixture.seedKey))
        .unique();

      let clientId = existingClient?._id;
      if (!clientId) {
        clientId = await ctx.db.insert("clients", {
          name: fixture.name,
          seedData: true,
          seedKey: fixture.seedKey,
        });
      }

      if (fixture.followUp) {
        await upsertFollowUp(ctx, {
          clientId,
          dueDate: shiftDayKey(today, fixture.followUp.dueDateOffset),
          actionType: fixture.followUp.actionType,
          seedData: true,
        });
      }
    }

    return null;
  },
});

export const clearSeed = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Usa el índice by_seedData (no un .collect() de la tabla completa) y
    // borra solo lo marcado seedData: true — limpieza limitada e
    // identificable, no toca nada creado manualmente.
    const seedFollowUps = await ctx.db
      .query("followUps")
      .withIndex("by_seedData", (q) => q.eq("seedData", true))
      .collect();
    for (const row of seedFollowUps) await ctx.db.delete(row._id);

    const seedClients = await ctx.db
      .query("clients")
      .withIndex("by_seedData", (q) => q.eq("seedData", true))
      .collect();
    for (const row of seedClients) await ctx.db.delete(row._id);

    return null;
  },
});
