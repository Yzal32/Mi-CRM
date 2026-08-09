import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { discardFollowUp } from "./model/followUps";

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

describe("discardFollowUp", () => {
  test("borra el seguimiento sin crear ninguna nota", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    const followUpId = await t.run((ctx) => ctx.db.insert("followUps", { clientId, dueDate: "2026-08-08", actionType: "call" }));

    const notesBefore = await t.run((ctx) => ctx.db.query("notes").collect());
    await t.run((ctx) => discardFollowUp(ctx, { followUpId }));
    const notesAfter = await t.run((ctx) => ctx.db.query("notes").collect());

    expect(await t.run((ctx) => ctx.db.get(followUpId))).toBeNull();
    expect(notesAfter).toHaveLength(notesBefore.length);
  });

  test("FOLLOW_UP_NOT_FOUND si no existe", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    const followUpId = await t.run((ctx) => ctx.db.insert("followUps", { clientId, dueDate: "2026-08-08", actionType: "call" }));
    await t.run((ctx) => ctx.db.delete(followUpId));

    const error = await captureError(t.run((ctx) => discardFollowUp(ctx, { followUpId })));
    expect(error.data.code).toBe("FOLLOW_UP_NOT_FOUND");
  });
});
