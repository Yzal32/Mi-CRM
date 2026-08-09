import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("seed", () => {
  test("es idempotente: ejecutarlo dos veces no duplica clientes ni seguimientos", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.seed, {});
    await t.mutation(internal.seed.seed, {});

    const counts = await t.run(async (ctx) => {
      const clients = await ctx.db.query("clients").collect();
      const followUps = await ctx.db.query("followUps").collect();
      return { clients: clients.length, followUps: followUps.length };
    });

    // 7 fixtures en convex/seed.ts, 6 de ellas con seguimiento (una,
    // "Lucía Fernández", no tiene seguimiento a propósito).
    expect(counts.clients).toBe(7);
    expect(counts.followUps).toBe(6);
  });

  test("los clientes sembrados pasan por createClient con sus campos completos", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.seed, {});

    const carlos = await t.run(async (ctx) =>
      ctx.db
        .query("clients")
        .withIndex("by_seedKey", (q) => q.eq("seedKey", "seed:carlos-ruiz"))
        .unique(),
    );

    expect(carlos?.phone).toBe("600000001");
    expect(carlos?.phoneKey).toBe("600000001");
    expect(carlos?.status).toBe("new");
    expect(carlos?.originChannel).toBe("web");
    expect(carlos?.signupDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("clearSeed borra solo los datos sembrados, no los creados manualmente", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.seed, {});

    const manualClientId = await t.run(async (ctx) => {
      const clientId = await ctx.db.insert("clients", { name: "Cliente Manual" });
      await ctx.db.insert("followUps", { clientId, dueDate: "2026-08-08", actionType: "call" });
      return clientId;
    });

    await t.mutation(internal.seed.clearSeed, {});

    const remaining = await t.run(async (ctx) => {
      const clients = await ctx.db.query("clients").collect();
      const followUps = await ctx.db.query("followUps").collect();
      return { clients, followUps };
    });

    expect(remaining.clients).toHaveLength(1);
    expect(remaining.clients[0]._id).toBe(manualClientId);
    expect(remaining.followUps).toHaveLength(1);
  });

  test("rechaza argumentos no declarados (seedData no se puede inyectar desde fuera)", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(internal.seed.seed, { seedData: true } as never)).rejects.toThrow();
  });

  test("siembra notas (una destacada) y una venta, de forma idempotente", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.seed, {});
    await t.mutation(internal.seed.seed, {});

    const counts = await t.run(async (ctx) => {
      const notes = await ctx.db.query("notes").collect();
      const sales = await ctx.db.query("sales").collect();
      return { notes: notes.length, sales: sales.length };
    });

    // 2 notas en Carlos Ruiz + 1 venta en Ana Torres, ver convex/seed.ts.
    expect(counts.notes).toBe(2);
    expect(counts.sales).toBe(1);

    const carlos = await t.run((ctx) =>
      ctx.db
        .query("clients")
        .withIndex("by_seedKey", (q) => q.eq("seedKey", "seed:carlos-ruiz"))
        .unique(),
    );
    const carlosNotes = await t.run((ctx) =>
      ctx.db
        .query("notes")
        .withIndex("by_client_date", (q) => q.eq("clientId", carlos!._id))
        .collect(),
    );
    expect(carlosNotes.filter((n) => n.featured)).toHaveLength(1);
    expect(carlosNotes.filter((n) => !n.featured)).toHaveLength(1);
    expect(carlosNotes.every((n) => n.authorName === "Datos de ejemplo")).toBe(true);
  });

  test("clearSeed en cascada borra también lo creado manualmente sobre un cliente sembrado (no queda huérfano)", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.seed, {});

    const carlos = await t.run((ctx) =>
      ctx.db
        .query("clients")
        .withIndex("by_seedKey", (q) => q.eq("seedKey", "seed:carlos-ruiz"))
        .unique(),
    );
    const manualNoteId = await t.run((ctx) =>
      ctx.db.insert("notes", {
        clientId: carlos!._id,
        date: "2026-08-08",
        text: "Nota manual sobre un cliente sembrado",
        featured: false,
        authorId: "x",
        authorName: "X",
      }),
    );

    await t.mutation(internal.seed.clearSeed, {});

    expect(await t.run((ctx) => ctx.db.get(manualNoteId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(carlos!._id))).toBeNull();
  });
});
