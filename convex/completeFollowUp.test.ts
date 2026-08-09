import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { completeFollowUp } from "./model/followUps";

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

const AUTHOR = { authorId: "stub-marta", authorName: "Marta" };

describe("completeFollowUp", () => {
  test.each([
    ["call", "Llamar"],
    ["whatsapp", "WhatsApp"],
    ["email", "Email"],
    ["visit", "Visita"],
  ] as const)("crea la nota canónica para actionType=%s", async (actionType, label) => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    const followUpId = await t.run((ctx) => ctx.db.insert("followUps", { clientId, dueDate: "2026-08-08", actionType }));

    const noteId = await t.run((ctx) => completeFollowUp(ctx, { followUpId, ...AUTHOR }));

    const note = await t.run((ctx) => ctx.db.get(noteId));
    expect(note?.text).toBe(`Seguimiento completado: ${label} (08/08/2026).`);
    expect(note?.featured).toBe(false);
    expect(note?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // fecha de hoy (de la mutation), no la dueDate prevista

    const followUp = await t.run((ctx) => ctx.db.get(followUpId));
    expect(followUp).toBeNull();
  });

  test("FOLLOW_UP_NOT_FOUND si el seguimiento no existe", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    const followUpId = await t.run((ctx) => ctx.db.insert("followUps", { clientId, dueDate: "2026-08-08", actionType: "call" }));
    await t.run((ctx) => ctx.db.delete(followUpId));

    const error = await captureError(t.run((ctx) => completeFollowUp(ctx, { followUpId, ...AUTHOR })));
    expect(error.data.code).toBe("FOLLOW_UP_NOT_FOUND");
  });

  test("si el cliente ya no existe, propaga CLIENT_NOT_FOUND y el seguimiento sigue existiendo (transaccional)", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    const followUpId = await t.run((ctx) => ctx.db.insert("followUps", { clientId, dueDate: "2026-08-08", actionType: "call" }));
    await t.run((ctx) => ctx.db.delete(clientId));

    const error = await captureError(t.run((ctx) => completeFollowUp(ctx, { followUpId, ...AUTHOR })));
    expect(error.data.code).toBe("CLIENT_NOT_FOUND");

    const followUp = await t.run((ctx) => ctx.db.get(followUpId));
    expect(followUp).not.toBeNull();
  });
});
