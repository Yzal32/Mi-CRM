import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { upsertFollowUp } from "./model/followUps";

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

const ACTOR = { assigneeId: "stub-marta", assigneeName: "Marta" };

describe("upsertFollowUp", () => {
  test("inserta la primera vez y actualiza (no duplica) la segunda", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run(async (ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    await t.run((ctx) => upsertFollowUp(ctx, { clientId, dueDate: "2026-08-08", actionType: "call", ...ACTOR }));
    await t.run((ctx) => upsertFollowUp(ctx, { clientId, dueDate: "2026-08-10", actionType: "email", ...ACTOR }));

    const rows = await t.run((ctx) =>
      ctx.db
        .query("followUps")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect(),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].dueDate).toBe("2026-08-10");
    expect(rows[0].actionType).toBe("email");
    expect(rows[0].assigneeId).toBe("stub-marta");
  });

  // Documenta a propósito, no por casualidad: upsertFollowUp NUNCA valida
  // "no en el pasado" — esa comprobación vive solo en la mutation pública
  // followUps.upsert (convex/followUps.ts). Es necesario porque
  // convex/seed.ts llama a este helper directamente con fechas pasadas
  // (dueDateOffset negativo) para generar seguimientos atrasados de
  // demostración. Sin este test, alguien podría "corregir" esto añadiendo
  // la validación aquí y romper el seeding sin darse cuenta.
  test("acepta una fecha pasada a propósito — excepción necesaria para convex/seed.ts", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run(async (ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const followUpId = await t.run((ctx) =>
      upsertFollowUp(ctx, { clientId, dueDate: "2020-01-01", actionType: "call", ...ACTOR }),
    );

    const doc = await t.run((ctx) => ctx.db.get(followUpId));
    expect(doc?.dueDate).toBe("2020-01-01");
  });

  test("rechaza una dueDate inválida con error tipado", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run(async (ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const error = await captureError(
      t.run((ctx) => upsertFollowUp(ctx, { clientId, dueDate: "no-es-fecha", actionType: "call", ...ACTOR })),
    );
    expect(error.data.code).toBe("INVALID_DUE_DATE");
  });

  test("rechaza un cliente inexistente", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run(async (ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run((ctx) => ctx.db.delete(clientId));

    const error = await captureError(
      t.run((ctx) => upsertFollowUp(ctx, { clientId, dueDate: "2026-08-08", actionType: "call", ...ACTOR })),
    );
    expect(error.data.code).toBe("CLIENT_NOT_FOUND");
  });

  test("repara duplicados preexistentes conservando el más reciente", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run(async (ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    await t.run(async (ctx) => {
      await ctx.db.insert("followUps", { clientId, dueDate: "2026-08-01", actionType: "call" });
      await ctx.db.insert("followUps", { clientId, dueDate: "2026-08-02", actionType: "email" });
    });

    await t.run((ctx) => upsertFollowUp(ctx, { clientId, dueDate: "2026-08-09", actionType: "visit", ...ACTOR }));

    const rows = await t.run((ctx) =>
      ctx.db
        .query("followUps")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].dueDate).toBe("2026-08-09");
  });

  test("reprogramar una fila antigua sin assigneeId no revienta", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run(async (ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    // Simula una fila creada antes de que existieran assigneeId/assigneeName
    // (opcionales en schema por compatibilidad — ver convex/schema.ts, decisión 1 del plan).
    await t.run((ctx) => ctx.db.insert("followUps", { clientId, dueDate: "2026-08-01", actionType: "call" }));

    await t.run((ctx) => upsertFollowUp(ctx, { clientId, dueDate: "2026-08-09", actionType: "visit", ...ACTOR }));

    const rows = await t.run((ctx) =>
      ctx.db
        .query("followUps")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].assigneeId).toBe("stub-marta");
  });
});
