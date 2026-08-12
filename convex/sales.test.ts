import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { issueTestAccessToken } from "./testHelpers";

const modules = import.meta.glob("./**/*.ts");

type CodeErrorData = { code: string; message: string };

async function captureError(promise: Promise<unknown>): Promise<ConvexError<CodeErrorData>> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ConvexError) return error as ConvexError<CodeErrorData>;
    throw error;
  }
  throw new Error("se esperaba que la promesa fallara");
}

describe("sales.create (capa pública)", () => {
  test("delega en el modelo y asigna el autor de servidor, no uno del cliente", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const saleId = await t.mutation(api.sales.create, { token, clientId, description: "Pack básico", amountCents: 15000 });
    const doc = await t.run((ctx) => ctx.db.get(saleId));

    expect(doc?.description).toBe("Pack básico");
    expect(doc?.amountCents).toBe(15000);
    expect(doc?.authorId).toBe("stub-marta");
    expect(doc?.authorName).toBe("Marta");
  });

  test("propaga un código de error del modelo tal cual (INVALID_AMOUNT)", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const error = await captureError(
      t.mutation(api.sales.create, { token, clientId, description: "Venta", amountCents: 0 }),
    );
    expect(error.data.code).toBe("INVALID_AMOUNT");
  });

  test("rechaza sin token válido con UNAUTHENTICATED, sin escritura parcial", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const error = await captureError(
      t.mutation(api.sales.create, { token: "a".repeat(64), clientId, description: "Venta", amountCents: 1000 }),
    );
    expect(error.data.code).toBe("UNAUTHENTICATED");
    expect(await t.run((ctx) => ctx.db.query("sales").collect())).toHaveLength(0);
  });
});

describe("sales.listByClient", () => {
  test("devuelve las ventas más recientes primero", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run(async (ctx) => {
      await ctx.db.insert("sales", { clientId, description: "Antigua", amountCents: 1000, date: "2026-08-01", authorId: "a", authorName: "A" });
      await ctx.db.insert("sales", { clientId, description: "Reciente", amountCents: 2000, date: "2026-08-05", authorId: "a", authorName: "A" });
    });

    const result = await t.query(api.sales.listByClient, { token, clientId });
    expect(result.items.map((s) => s.description)).toEqual(["Reciente", "Antigua"]);
    expect(result.truncated).toBe(false);
  });

  test("truncated es true por encima de 500 ventas", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run(async (ctx) => {
      for (let i = 0; i < 501; i++) {
        await ctx.db.insert("sales", { clientId, description: `Venta ${i}`, amountCents: 100, date: "2026-08-08", authorId: "a", authorName: "A" });
      }
    });

    const result = await t.query(api.sales.listByClient, { token, clientId });
    expect(result.truncated).toBe(true);
    expect(result.items).toHaveLength(500);
  }, 30000);

  test("DTO no expone seedData ni seedKey", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run((ctx) =>
      ctx.db.insert("sales", { clientId, description: "Venta", amountCents: 100, date: "2026-08-08", authorId: "a", authorName: "A", seedData: true, seedKey: "x" }),
    );

    const result = await t.query(api.sales.listByClient, { token, clientId });
    expect(result.items[0]).not.toHaveProperty("seedData");
    expect(result.items[0]).not.toHaveProperty("seedKey");
  });

  test("rechaza sin token válido con UNAUTHENTICATED", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    let caught: unknown;
    try {
      await t.query(api.sales.listByClient, { token: "a".repeat(64), clientId });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("UNAUTHENTICATED");
  });
});
