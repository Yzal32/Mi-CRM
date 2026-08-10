import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { LIMIT } from "./followUps";
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

describe("listToday", () => {
  test("separa atrasados y de hoy, excluye futuros, ignora clientes sin seguimiento", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const today = "2026-08-08";

    await t.run(async (ctx) => {
      const overdueClient = await ctx.db.insert("clients", { name: "Cliente Atrasado" });
      await ctx.db.insert("followUps", { clientId: overdueClient, dueDate: "2026-08-07", actionType: "call" });

      const todayClient = await ctx.db.insert("clients", { name: "Cliente Hoy" });
      await ctx.db.insert("followUps", { clientId: todayClient, dueDate: today, actionType: "whatsapp" });

      const futureClient = await ctx.db.insert("clients", { name: "Cliente Futuro" });
      await ctx.db.insert("followUps", { clientId: futureClient, dueDate: "2026-08-09", actionType: "email" });

      await ctx.db.insert("clients", { name: "Sin Seguimiento" });
    });

    const result = await t.query(api.followUps.listToday, { token, today });

    expect(result.overdue).toHaveLength(1);
    expect(result.overdue[0].clientName).toBe("Cliente Atrasado");
    expect(result.overdue[0].diffDays).toBe(1);
    expect(result.today).toHaveLength(1);
    expect(result.today[0].clientName).toBe("Cliente Hoy");
    expect(result.today[0].diffDays).toBe(0);
    expect(result.overdueTruncated).toBe(false);
    expect(result.todayTruncated).toBe(false);
  });

  test("filtra por nombre de cliente (case-insensitive, substring)", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const today = "2026-08-08";
    await t.run(async (ctx) => {
      const a = await ctx.db.insert("clients", { name: "Carlos Ruiz" });
      await ctx.db.insert("followUps", { clientId: a, dueDate: today, actionType: "call" });
      const b = await ctx.db.insert("clients", { name: "Ana Torres" });
      await ctx.db.insert("followUps", { clientId: b, dueDate: today, actionType: "email" });
    });

    const result = await t.query(api.followUps.listToday, { token, today, search: "carl" });
    expect(result.today).toHaveLength(1);
    expect(result.today[0].clientName).toBe("Carlos Ruiz");
  });

  test("no rompe con una fila followUps huérfana (cliente borrado directamente)", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const today = "2026-08-08";
    await t.run(async (ctx) => {
      const clientId = await ctx.db.insert("clients", { name: "Cliente A Borrar" });
      await ctx.db.insert("followUps", { clientId, dueDate: today, actionType: "call" });
      await ctx.db.delete(clientId);
    });

    const result = await t.query(api.followUps.listToday, { token, today });
    expect(result.today).toHaveLength(0);
  });

  test("rechaza today malformado", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await expect(t.query(api.followUps.listToday, { token, today: "no-es-una-fecha" })).rejects.toThrow();
  });

  test("rechaza today con año fuera del rango permitido", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await expect(t.query(api.followUps.listToday, { token, today: "0099-01-01" })).rejects.toThrow();
  });

  test("rechaza sin token válido con UNAUTHENTICATED", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(t.query(api.followUps.listToday, { token: "a".repeat(64), today: "2026-08-08" }));
    expect(error.data.code).toBe("UNAUTHENTICATED");
  });

  test("un backlog de atrasados por encima del límite no oculta los de hoy (ronda 2)", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const today = "2026-08-08";
    await t.run(async (ctx) => {
      for (let i = 0; i < LIMIT + 5; i++) {
        const clientId = await ctx.db.insert("clients", { name: `Atrasado ${i}` });
        await ctx.db.insert("followUps", { clientId, dueDate: "2020-01-01", actionType: "call" });
      }
      const todayClient = await ctx.db.insert("clients", { name: "Hoy Visible" });
      await ctx.db.insert("followUps", { clientId: todayClient, dueDate: today, actionType: "call" });
    });

    const result = await t.query(api.followUps.listToday, { token, today });
    expect(result.overdueTruncated).toBe(true);
    expect(result.overdue).toHaveLength(LIMIT);
    expect(result.todayTruncated).toBe(false);
    expect(result.today).toHaveLength(1);
    expect(result.today[0].clientName).toBe("Hoy Visible");
  }, 30000);

  test("búsqueda cuya única coincidencia cae fuera de la ventana truncada marca todayTruncated (ronda 3)", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const today = "2026-08-08";
    await t.run(async (ctx) => {
      for (let i = 0; i < LIMIT; i++) {
        const clientId = await ctx.db.insert("clients", { name: `Relleno ${i}` });
        await ctx.db.insert("followUps", { clientId, dueDate: today, actionType: "call" });
      }
      // Se inserta después de los LIMIT de relleno: queda en la posición
      // LIMIT+1, fuera de la ventana que listToday recorta.
      const target = await ctx.db.insert("clients", { name: "Objetivo Buscado" });
      await ctx.db.insert("followUps", { clientId: target, dueDate: today, actionType: "call" });
    });

    const result = await t.query(api.followUps.listToday, { token, today, search: "Objetivo" });
    expect(result.todayTruncated).toBe(true);
    // El objetivo real existe pero queda fuera de la ventana truncada: el
    // array filtrado queda vacío. Esto es justo lo que HoyScreen/
    // deriveHoyViewState debe distinguir de un "Sin resultados" real.
    expect(result.today).toHaveLength(0);
  }, 30000);
});

describe("followUps.upsert / complete / discard / getByClient (capa pública)", () => {
  test("upsert delega en el modelo y asigna el responsable de servidor, no uno del cliente", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const followUpId = await t.mutation(api.followUps.upsert, { token, clientId, dueDate: "2026-08-08", actionType: "call" });
    const doc = await t.run((ctx) => ctx.db.get(followUpId));

    expect(doc?.assigneeId).toBe("stub-marta");
    expect(doc?.assigneeName).toBe("Marta");
  });

  test("upsert rechaza sin token válido con UNAUTHENTICATED, sin escritura parcial", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    const error = await captureError(
      t.mutation(api.followUps.upsert, { token: "a".repeat(64), clientId, dueDate: "2026-08-08", actionType: "call" }),
    );
    expect(error.data.code).toBe("UNAUTHENTICATED");
    expect(await t.run((ctx) => ctx.db.query("followUps").collect())).toHaveLength(0);
  });

  test("upsert expone CLIENT_NOT_FOUND en error.data.code", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run((ctx) => ctx.db.delete(clientId));

    const error = await captureError(t.mutation(api.followUps.upsert, { token, clientId, dueDate: "2026-08-08", actionType: "call" }));
    expect(error.data.code).toBe("CLIENT_NOT_FOUND");
  });

  test("complete delega en el modelo (crea nota, borra el seguimiento)", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    const followUpId = await t.mutation(api.followUps.upsert, { token, clientId, dueDate: "2026-08-08", actionType: "call" });

    const noteId = await t.mutation(api.followUps.complete, { token, followUpId });

    expect(await t.run((ctx) => ctx.db.get(noteId))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(followUpId))).toBeNull();
  });

  test("discard delega en el modelo (borra sin crear nota)", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    const followUpId = await t.mutation(api.followUps.upsert, { token, clientId, dueDate: "2026-08-08", actionType: "call" });

    await t.mutation(api.followUps.discard, { token, followUpId });

    expect(await t.run((ctx) => ctx.db.get(followUpId))).toBeNull();
  });

  test("getByClient devuelve null si no hay ningún seguimiento", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));

    expect(await t.query(api.followUps.getByClient, { token, clientId })).toBeNull();
  });

  test("getByClient devuelve el seguimiento del cliente, DTO sin seedData", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run((ctx) => ctx.db.insert("followUps", { clientId, dueDate: "2026-08-08", actionType: "call", seedData: true }));

    const result = await t.query(api.followUps.getByClient, { token, clientId });
    expect(result?.dueDate).toBe("2026-08-08");
    expect(result).not.toHaveProperty("seedData");
  });

  test("getByClient no usa .unique(): con duplicados transitorios, devuelve el más reciente sin lanzar", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const clientId = await t.run((ctx) => ctx.db.insert("clients", { name: "Cliente Test" }));
    await t.run(async (ctx) => {
      await ctx.db.insert("followUps", { clientId, dueDate: "2026-08-01", actionType: "call" });
      await ctx.db.insert("followUps", { clientId, dueDate: "2026-08-09", actionType: "visit" });
    });

    const result = await t.query(api.followUps.getByClient, { token, clientId });
    expect(result?.dueDate).toBe("2026-08-09");
  });
});
