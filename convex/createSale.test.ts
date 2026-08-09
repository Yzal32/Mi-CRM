import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { createSale } from "./model/sales";

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

const AUTHOR = { authorId: "seed-author", authorName: "Datos de ejemplo" };

describe("createSale", () => {
  test("alta con todos los campos", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const id = await t.run((ctx) => createSale(ctx, { clientId, description: "  Pack básico  ", amountCents: 15000, ...AUTHOR }));
    const doc = await t.run((ctx) => ctx.db.get(id));

    expect(doc?.description).toBe("Pack básico"); // recortado, no solo validado
    expect(doc?.amountCents).toBe(15000);
    expect(doc?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(doc?.authorId).toBe("seed-author");
  });

  test("DESCRIPTION_REQUIRED con descripción vacía", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const error = await captureError(t.run((ctx) => createSale(ctx, { clientId, description: "   ", amountCents: 100, ...AUTHOR })));
    expect(error.data.code).toBe("DESCRIPTION_REQUIRED");
  });

  test("DESCRIPTION_TOO_LONG por encima de 300 caracteres", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const error = await captureError(
      t.run((ctx) => createSale(ctx, { clientId, description: "a".repeat(301), amountCents: 100, ...AUTHOR })),
    );
    expect(error.data.code).toBe("DESCRIPTION_TOO_LONG");
  });

  test.each([0, -100, 10.5, Number.MAX_SAFE_INTEGER + 1, 1_000_000_000])(
    "INVALID_AMOUNT con amountCents = %s",
    async (amountCents) => {
      const t = convexTest(schema, modules);
      const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

      const error = await captureError(t.run((ctx) => createSale(ctx, { clientId, description: "Venta", amountCents, ...AUTHOR })));
      expect(error.data.code).toBe("INVALID_AMOUNT");
    },
  );

  test("CLIENT_NOT_FOUND con un cliente borrado", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run((ctx) => ctx.db.delete(clientId));

    const error = await captureError(t.run((ctx) => createSale(ctx, { clientId, description: "Venta", amountCents: 100, ...AUTHOR })));
    expect(error.data.code).toBe("CLIENT_NOT_FOUND");
  });
});
