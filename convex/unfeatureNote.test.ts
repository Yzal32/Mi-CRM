import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { unfeatureNote } from "./model/notes";

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

describe("unfeatureNote", () => {
  test("desmarca una nota destacada", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    const noteId = await t.run((ctx) =>
      ctx.db.insert("notes", { clientId, date: "2026-08-08", text: "Nota", featured: true, authorId: "a", authorName: "A" }),
    );

    await t.run((ctx) => unfeatureNote(ctx, { noteId }));

    const note = await t.run((ctx) => ctx.db.get(noteId));
    expect(note?.featured).toBe(false);
  });

  test("es idempotente: no hace nada si ya estaba desmarcada", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    const noteId = await t.run((ctx) =>
      ctx.db.insert("notes", { clientId, date: "2026-08-08", text: "Nota", featured: false, authorId: "a", authorName: "A" }),
    );

    await t.run((ctx) => unfeatureNote(ctx, { noteId }));
    const note = await t.run((ctx) => ctx.db.get(noteId));
    expect(note?.featured).toBe(false);
  });

  test("NOTE_NOT_FOUND si el noteId no existe", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    const noteId = await t.run((ctx) =>
      ctx.db.insert("notes", { clientId, date: "2026-08-08", text: "Nota", featured: true, authorId: "a", authorName: "A" }),
    );
    await t.run((ctx) => ctx.db.delete(noteId));

    const error = await captureError(t.run((ctx) => unfeatureNote(ctx, { noteId })));
    expect(error.data.code).toBe("NOTE_NOT_FOUND");
  });
});
