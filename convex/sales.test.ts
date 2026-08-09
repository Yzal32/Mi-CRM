import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import * as sales from "./sales";

const modules = import.meta.glob("./**/*.ts");

describe("sales (capa pública)", () => {
  test("no existe una mutation pública de creación de ventas", () => {
    // Comprobarlo vía api.sales.create no serviría: el `api` generado usa
    // anyApi (convex/_generated/api.js), que genera una referencia válida
    // para cualquier ruta se pida exista o no de verdad. Importando el
    // módulo real sí se puede comprobar que la propiedad no existe.
    expect("create" in sales).toBe(false);
  });

  test("listByClient devuelve las ventas más recientes primero", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run(async (ctx) => {
      await ctx.db.insert("sales", { clientId, description: "Antigua", amountCents: 1000, date: "2026-08-01", authorId: "a", authorName: "A" });
      await ctx.db.insert("sales", { clientId, description: "Reciente", amountCents: 2000, date: "2026-08-05", authorId: "a", authorName: "A" });
    });

    const result = await t.query(api.sales.listByClient, { clientId });
    expect(result.items.map((s) => s.description)).toEqual(["Reciente", "Antigua"]);
    expect(result.truncated).toBe(false);
  });

  test("truncated es true por encima de 500 ventas", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run(async (ctx) => {
      for (let i = 0; i < 501; i++) {
        await ctx.db.insert("sales", { clientId, description: `Venta ${i}`, amountCents: 100, date: "2026-08-08", authorId: "a", authorName: "A" });
      }
    });

    const result = await t.query(api.sales.listByClient, { clientId });
    expect(result.truncated).toBe(true);
    expect(result.items).toHaveLength(500);
  }, 30000);

  test("DTO no expone seedData ni seedKey", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run((ctx) =>
      ctx.db.insert("sales", { clientId, description: "Venta", amountCents: 100, date: "2026-08-08", authorId: "a", authorName: "A", seedData: true, seedKey: "x" }),
    );

    const result = await t.query(api.sales.listByClient, { clientId });
    expect(result.items[0]).not.toHaveProperty("seedData");
    expect(result.items[0]).not.toHaveProperty("seedKey");
  });
});
