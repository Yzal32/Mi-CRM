import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

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

describe("notes.create / notes.unfeature (capa pública)", () => {
  test("create delega en el modelo y asigna el autor de servidor, no uno del cliente", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const noteId = await t.mutation(api.notes.create, { clientId, text: "Primera nota" });
    const doc = await t.run((ctx) => ctx.db.get(noteId));

    expect(doc?.text).toBe("Primera nota");
    expect(doc?.authorId).toBe("stub-marta");
    expect(doc?.authorName).toBe("Marta");
  });

  test("create expone TEXT_REQUIRED en error.data.code", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const error = await captureError(t.mutation(api.notes.create, { clientId, text: "   " }));
    expect(error.data.code).toBe("TEXT_REQUIRED");
  });

  test("unfeature delega en el modelo", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    const noteId = await t.mutation(api.notes.create, { clientId, text: "Nota", featured: true });

    await t.mutation(api.notes.unfeature, { noteId });

    const doc = await t.run((ctx) => ctx.db.get(noteId));
    expect(doc?.featured).toBe(false);
  });
});

describe("notes.listByClient", () => {
  test("devuelve las notas más recientes primero", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run(async (ctx) => {
      await ctx.db.insert("notes", { clientId, date: "2026-08-01", text: "Antigua", featured: false, authorId: "a", authorName: "A" });
      await ctx.db.insert("notes", { clientId, date: "2026-08-05", text: "Reciente", featured: false, authorId: "a", authorName: "A" });
    });

    const result = await t.query(api.notes.listByClient, { clientId });
    expect(result.items.map((n) => n.text)).toEqual(["Reciente", "Antigua"]);
    expect(result.featured).toBeNull();
  });

  test("la destacada se devuelve aparte y no se duplica en items (500 normales + 1 destacada reciente)", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run(async (ctx) => {
      await ctx.db.insert("notes", { clientId, date: "2026-08-09", text: "Destacada", featured: true, authorId: "a", authorName: "A" });
      for (let i = 0; i < 500; i++) {
        await ctx.db.insert("notes", { clientId, date: "2026-08-08", text: `Nota ${i}`, featured: false, authorId: "a", authorName: "A" });
      }
    });

    const result = await t.query(api.notes.listByClient, { clientId });
    expect(result.featured?.text).toBe("Destacada");
    expect(result.items).toHaveLength(500);
    expect(result.items.some((n) => n.featured)).toBe(false);
    expect(result.truncated).toBe(false);
  }, 30000);

  test("truncated es true con 501 notas normales + 1 destacada reciente (necesita el margen de +2 sobre 500)", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run(async (ctx) => {
      await ctx.db.insert("notes", { clientId, date: "2026-08-09", text: "Destacada", featured: true, authorId: "a", authorName: "A" });
      for (let i = 0; i < 501; i++) {
        await ctx.db.insert("notes", { clientId, date: "2026-08-08", text: `Nota ${i}`, featured: false, authorId: "a", authorName: "A" });
      }
    });

    const result = await t.query(api.notes.listByClient, { clientId });
    expect(result.truncated).toBe(true);
    expect(result.items).toHaveLength(500);
  }, 30000);

  test("una destacada antigua sigue devolviéndose aunque haya más de 500 notas posteriores", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run(async (ctx) => {
      await ctx.db.insert("notes", { clientId, date: "2020-01-01", text: "Destacada antigua", featured: true, authorId: "a", authorName: "A" });
      for (let i = 0; i < 501; i++) {
        await ctx.db.insert("notes", { clientId, date: "2026-08-08", text: `Nota ${i}`, featured: false, authorId: "a", authorName: "A" });
      }
    });

    const result = await t.query(api.notes.listByClient, { clientId });
    expect(result.featured?.text).toBe("Destacada antigua");
    expect(result.truncated).toBe(true);
    expect(result.items).toHaveLength(500);
  }, 30000);

  test("DTO no expone seedData ni seedKey", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run((ctx) =>
      ctx.db.insert("notes", { clientId, date: "2026-08-08", text: "Nota", featured: false, authorId: "a", authorName: "A", seedData: true, seedKey: "x" }),
    );

    const result = await t.query(api.notes.listByClient, { clientId });
    expect(result.items[0]).not.toHaveProperty("seedData");
    expect(result.items[0]).not.toHaveProperty("seedKey");
  });
});
