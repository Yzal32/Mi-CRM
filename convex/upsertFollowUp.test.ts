import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { upsertFollowUp } from "./model/followUps";

const modules = import.meta.glob("./**/*.ts");

describe("upsertFollowUp", () => {
  test("inserta la primera vez y actualiza (no duplica) la segunda", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run(async (ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    await t.run((ctx) => upsertFollowUp(ctx, { clientId, dueDate: "2026-08-08", actionType: "call" }));
    await t.run((ctx) => upsertFollowUp(ctx, { clientId, dueDate: "2026-08-10", actionType: "email" }));

    const rows = await t.run((ctx) =>
      ctx.db
        .query("followUps")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect(),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].dueDate).toBe("2026-08-10");
    expect(rows[0].actionType).toBe("email");
  });

  test("rechaza una dueDate inválida", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run(async (ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    await expect(
      t.run((ctx) => upsertFollowUp(ctx, { clientId, dueDate: "no-es-fecha", actionType: "call" })),
    ).rejects.toThrow();
  });

  test("repara duplicados preexistentes conservando el más reciente", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run(async (ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    await t.run(async (ctx) => {
      await ctx.db.insert("followUps", { clientId, dueDate: "2026-08-01", actionType: "call" });
      await ctx.db.insert("followUps", { clientId, dueDate: "2026-08-02", actionType: "email" });
    });

    await t.run((ctx) => upsertFollowUp(ctx, { clientId, dueDate: "2026-08-09", actionType: "visit" }));

    const rows = await t.run((ctx) =>
      ctx.db
        .query("followUps")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].dueDate).toBe("2026-08-09");
  });
});
