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
});
