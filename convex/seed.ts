import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { addDays, businessDayKey } from "../lib/shared/businessDay";
import type { ActionType } from "../lib/shared/actionType";
import { upsertFollowUp } from "./model/followUps";
import { createClient } from "./model/clients";
import { createNote } from "./model/notes";
import { createSale } from "./model/sales";

/**
 * `seed` y `clearSeed` son `internalMutation`: solo se pueden invocar desde
 * la CLI (`npx convex run seed:seed`) o desde otras funciones del servidor,
 * nunca desde el navegador. Ver plan, sección "Seguridad y modelo de
 * datos" — esto solo debe ejecutarse contra un deployment de desarrollo con
 * datos ficticios.
 */

// Identidad distinta de la que usan las mutations públicas (siempre la del
// usuario autenticado real, vía requireAccessToken) — para que los datos de
// fixture se distingan a simple vista de lo que crearía alguien usando la
// app de verdad.
const SEED_AUTHOR = { id: "seed-author", name: "Datos de ejemplo" };

type Fixture = {
  seedKey: string;
  name: string;
  phone: string;
  followUp?: { actionType: ActionType; dueDateOffset: number };
  notes?: Array<{ seedKey: string; text: string; featured?: boolean; channel?: ActionType }>;
  sale?: { seedKey: string; description: string; amountCents: number };
};

// dueDateOffset se resuelve contra el "hoy" del momento en que se ejecuta el
// seed (días relativos), no fechas fijas — así los datos de prueba siguen
// siendo correctos (atrasados/hoy/futuro) sin importar cuándo se siembre.
//
// Los teléfonos usan el prefijo 6000000xx, reservado solo para fixtures de
// seed — las pruebas manuales en local y los smoke tests contra Railway
// deben usar otros prefijos (6111111xx / 6222222xx) para no chocar por
// DUPLICATE_PHONE con estos datos y bloquear un re-seed.
const FIXTURES: Fixture[] = [
  {
    seedKey: "seed:carlos-ruiz",
    name: "Carlos Ruiz",
    phone: "600000001",
    followUp: { actionType: "call", dueDateOffset: -1 },
    notes: [
      {
        seedKey: "seed:carlos-ruiz:nota-1",
        text: "Interesado en el paquete premium, pidió que le llamáramos esta semana.",
        featured: true,
        channel: "call",
      },
      {
        seedKey: "seed:carlos-ruiz:nota-2",
        text: "Primer contacto por WhatsApp, preguntó por precios.",
        channel: "whatsapp",
      },
    ],
  },
  {
    seedKey: "seed:ana-torres",
    name: "Ana Torres",
    phone: "600000002",
    followUp: { actionType: "whatsapp", dueDateOffset: -3 },
    sale: { seedKey: "seed:ana-torres:venta-1", description: "Pack básico", amountCents: 15000 },
  },
  {
    seedKey: "seed:maria-lopez",
    name: "María López",
    phone: "600000003",
    followUp: { actionType: "call", dueDateOffset: 0 },
  },
  {
    seedKey: "seed:marta-gomez",
    name: "Marta Gómez",
    phone: "600000004",
    followUp: { actionType: "visit", dueDateOffset: 0 },
  },
  {
    seedKey: "seed:javier-soto",
    name: "Javier Soto",
    phone: "600000005",
    followUp: { actionType: "email", dueDateOffset: 0 },
  },
  { seedKey: "seed:lucia-fernandez", name: "Lucía Fernández", phone: "600000006" }, // sin seguimiento: no debe aparecer en Hoy
  {
    seedKey: "seed:diego-alonso",
    name: "Diego Alonso",
    phone: "600000007",
    followUp: { actionType: "call", dueDateOffset: 1 },
  }, // futuro: excluido de Hoy
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
        clientId = await createClient(ctx, {
          name: fixture.name,
          phone: fixture.phone,
          seedData: true,
          seedKey: fixture.seedKey,
        });
      }

      if (fixture.followUp) {
        await upsertFollowUp(ctx, {
          clientId,
          dueDate: addDays(today, fixture.followUp.dueDateOffset),
          actionType: fixture.followUp.actionType,
          assigneeId: SEED_AUTHOR.id,
          assigneeName: SEED_AUTHOR.name,
          seedData: true,
        });
      }

      for (const note of fixture.notes ?? []) {
        const existingNote = await ctx.db
          .query("notes")
          .withIndex("by_seedKey", (q) => q.eq("seedKey", note.seedKey))
          .unique();
        if (existingNote) continue;
        await createNote(ctx, {
          clientId,
          text: note.text,
          channel: note.channel,
          featured: note.featured,
          authorId: SEED_AUTHOR.id,
          authorName: SEED_AUTHOR.name,
          seedData: true,
          seedKey: note.seedKey,
        });
      }

      if (fixture.sale) {
        const existingSale = await ctx.db
          .query("sales")
          .withIndex("by_seedKey", (q) => q.eq("seedKey", fixture.sale!.seedKey))
          .unique();
        if (!existingSale) {
          await createSale(ctx, {
            clientId,
            description: fixture.sale.description,
            amountCents: fixture.sale.amountCents,
            authorId: SEED_AUTHOR.id,
            authorName: SEED_AUTHOR.name,
            seedData: true,
            seedKey: fixture.sale.seedKey,
          });
        }
      }
    }

    return null;
  },
});

export const clearSeed = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const seedClients = await ctx.db
      .query("clients")
      .withIndex("by_seedData", (q) => q.eq("seedData", true))
      .collect();

    // Cascada por cliente: borra TODAS las notas/ventas/seguimientos de cada
    // cliente sembrado que se va a borrar, sin filtrar por seedData — si
    // alguien creó manualmente una nota o un seguimiento sobre un cliente
    // sembrado, no debe sobrevivir como huérfano apuntando a un cliente ya
    // borrado.
    for (const client of seedClients) {
      const notes = await ctx.db
        .query("notes")
        .withIndex("by_client_date", (q) => q.eq("clientId", client._id))
        .collect();
      for (const note of notes) await ctx.db.delete(note._id);

      const sales = await ctx.db
        .query("sales")
        .withIndex("by_client_date", (q) => q.eq("clientId", client._id))
        .collect();
      for (const sale of sales) await ctx.db.delete(sale._id);

      const followUps = await ctx.db
        .query("followUps")
        .withIndex("by_client", (q) => q.eq("clientId", client._id))
        .collect();
      for (const followUp of followUps) await ctx.db.delete(followUp._id);

      await ctx.db.delete(client._id);
    }

    return null;
  },
});
