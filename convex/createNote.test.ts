import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { createNote } from "./model/notes";

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

describe("createNote", () => {
  test("alta con todos los campos", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const id = await t.run((ctx) =>
      createNote(ctx, { clientId, text: "  Primer contacto.  ", channel: "email", ...AUTHOR }),
    );
    const doc = await t.run((ctx) => ctx.db.get(id));

    expect(doc?.text).toBe("Primer contacto."); // recortado, no solo validado
    expect(doc?.featured).toBe(false);
    expect(doc?.authorId).toBe("stub-marta");
    expect(doc?.channel).toBe("email");
    expect(doc?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("alta sin channel lo deja undefined", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const id = await t.run((ctx) => createNote(ctx, { clientId, text: "Sin canal", ...AUTHOR }));
    const doc = await t.run((ctx) => ctx.db.get(id));

    expect(doc?.channel).toBeUndefined();
  });

  test("TEXT_REQUIRED con texto vacío o solo espacios", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const error = await captureError(t.run((ctx) => createNote(ctx, { clientId, text: "   ", ...AUTHOR })));
    expect(error.data.code).toBe("TEXT_REQUIRED");
  });

  test("TEXT_TOO_LONG por encima de 4000 caracteres", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const error = await captureError(
      t.run((ctx) => createNote(ctx, { clientId, text: "a".repeat(4001), ...AUTHOR })),
    );
    expect(error.data.code).toBe("TEXT_TOO_LONG");
  });

  test("CLIENT_NOT_FOUND con un cliente borrado", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run((ctx) => ctx.db.delete(clientId));

    const error = await captureError(t.run((ctx) => createNote(ctx, { clientId, text: "Nota", ...AUTHOR })));
    expect(error.data.code).toBe("CLIENT_NOT_FOUND");
  });

  test("una segunda nota destacada desmarca la primera", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const firstId = await t.run((ctx) =>
      createNote(ctx, { clientId, text: "Primera", featured: true, expectedFeaturedNoteId: null, ...AUTHOR }),
    );
    await t.run((ctx) =>
      createNote(ctx, { clientId, text: "Segunda", featured: true, expectedFeaturedNoteId: firstId, ...AUTHOR }),
    );

    const notes = await t.run((ctx) =>
      ctx.db
        .query("notes")
        .withIndex("by_client_date", (q) => q.eq("clientId", clientId))
        .collect(),
    );
    const featured = notes.filter((n) => n.featured);
    expect(featured).toHaveLength(1);
    expect(featured[0].text).toBe("Segunda");
  });

  test("una nota no destacada no afecta a la destacada existente", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const firstId = await t.run((ctx) =>
      createNote(ctx, { clientId, text: "Destacada", featured: true, expectedFeaturedNoteId: null, ...AUTHOR }),
    );
    await t.run((ctx) => createNote(ctx, { clientId, text: "Normal", ...AUTHOR }));

    const first = await t.run((ctx) => ctx.db.get(firstId));
    expect(first?.featured).toBe(true);
  });

  test("dos clientes distintos pueden tener cada uno su propia nota destacada", async () => {
    const t = convexTest(schema, modules);
    const clientA = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente A" }));
    const clientB = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente B" }));

    await t.run((ctx) =>
      createNote(ctx, { clientId: clientA, text: "A destacada", featured: true, expectedFeaturedNoteId: null, ...AUTHOR }),
    );
    await t.run((ctx) =>
      createNote(ctx, { clientId: clientB, text: "B destacada", featured: true, expectedFeaturedNoteId: null, ...AUTHOR }),
    );

    const [notesA, notesB] = await t.run(async (ctx) => [
      await ctx.db.query("notes").withIndex("by_client_featured", (q) => q.eq("clientId", clientA).eq("featured", true)).collect(),
      await ctx.db.query("notes").withIndex("by_client_featured", (q) => q.eq("clientId", clientB).eq("featured", true)).collect(),
    ]);
    expect(notesA).toHaveLength(1);
    expect(notesB).toHaveLength(1);
  });

  test("reparación defensiva: dos destacadas insertadas a mano se desmarcan al crear una tercera", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    await t.run(async (ctx) => {
      await ctx.db.insert("notes", {
        clientId,
        date: "2026-08-01",
        text: "Vieja 1",
        featured: true,
        authorId: "x",
        authorName: "X",
      });
      await ctx.db.insert("notes", {
        clientId,
        date: "2026-08-02",
        text: "Vieja 2",
        featured: true,
        authorId: "x",
        authorName: "X",
      });
    });

    // expectedFeaturedNoteId no puede predecirse aquí (hay dos destacadas
    // simultáneas, estado que no debería darse por el invariante) — se
    // fuerza el bypass del conflicto usando el modelo directamente sin esa
    // comprobación no tiene sentido: en su lugar, cualquier valor que no
    // coincida con "la primera destacada encontrada" dispara igualmente el
    // conflicto, así que se resuelve leyendo cuál sería antes de llamar.
    const current = await t.run((ctx) =>
      ctx.db.query("notes").withIndex("by_client_featured", (q) => q.eq("clientId", clientId).eq("featured", true)).collect(),
    );
    await t.run((ctx) =>
      createNote(ctx, {
        clientId,
        text: "Nueva",
        featured: true,
        expectedFeaturedNoteId: current[0]._id,
        ...AUTHOR,
      }),
    );

    const featured = await t.run((ctx) =>
      ctx.db.query("notes").withIndex("by_client_featured", (q) => q.eq("clientId", clientId).eq("featured", true)).collect(),
    );
    expect(featured).toHaveLength(1);
    expect(featured[0].text).toBe("Nueva");
  });

  test("FEATURED_NOTE_CONFLICT con expectedFeaturedNoteId obsoleto", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    // El cliente cree que no hay ninguna destacada (null), pero en
    // realidad ya se creó una — simula el estado obsoleto de una pestaña
    // que no ha recibido todavía la actualización reactiva.
    await t.run((ctx) =>
      createNote(ctx, { clientId, text: "Ya existente", featured: true, expectedFeaturedNoteId: null, ...AUTHOR }),
    );

    const error = await captureError(
      t.run((ctx) =>
        createNote(ctx, { clientId, text: "Intento con estado obsoleto", featured: true, expectedFeaturedNoteId: null, ...AUTHOR }),
      ),
    );
    expect(error.data.code).toBe("FEATURED_NOTE_CONFLICT");

    // La destacada original sigue siendo la que había, no la fallida.
    const featured = await t.run((ctx) =>
      ctx.db.query("notes").withIndex("by_client_featured", (q) => q.eq("clientId", clientId).eq("featured", true)).collect(),
    );
    expect(featured).toHaveLength(1);
    expect(featured[0].text).toBe("Ya existente");
  });

  test("dos altas concurrentes simuladas: la segunda con el expectedFeaturedNoteId previo a la primera falla", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    // Ambas "pestañas" leen el estado inicial (sin destacada) al mismo
    // tiempo, antes de que ninguna haya escrito.
    const expectedByBoth = null;

    await t.run((ctx) =>
      createNote(ctx, { clientId, text: "Pestaña A", featured: true, expectedFeaturedNoteId: expectedByBoth, ...AUTHOR }),
    );

    const error = await captureError(
      t.run((ctx) =>
        createNote(ctx, { clientId, text: "Pestaña B", featured: true, expectedFeaturedNoteId: expectedByBoth, ...AUTHOR }),
      ),
    );
    expect(error.data.code).toBe("FEATURED_NOTE_CONFLICT");
  });
});
