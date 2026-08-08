import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { LIMIT } from "./followUps";

const modules = import.meta.glob("./**/*.ts");

describe("listToday", () => {
  test("separa atrasados y de hoy, excluye futuros, ignora clientes sin seguimiento", async () => {
    const t = convexTest(schema, modules);
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

    const result = await t.query(api.followUps.listToday, { today });

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
    const today = "2026-08-08";
    await t.run(async (ctx) => {
      const a = await ctx.db.insert("clients", { name: "Carlos Ruiz" });
      await ctx.db.insert("followUps", { clientId: a, dueDate: today, actionType: "call" });
      const b = await ctx.db.insert("clients", { name: "Ana Torres" });
      await ctx.db.insert("followUps", { clientId: b, dueDate: today, actionType: "email" });
    });

    const result = await t.query(api.followUps.listToday, { today, search: "carl" });
    expect(result.today).toHaveLength(1);
    expect(result.today[0].clientName).toBe("Carlos Ruiz");
  });

  test("no rompe con una fila followUps huérfana (cliente borrado directamente)", async () => {
    const t = convexTest(schema, modules);
    const today = "2026-08-08";
    await t.run(async (ctx) => {
      const clientId = await ctx.db.insert("clients", { name: "Cliente A Borrar" });
      await ctx.db.insert("followUps", { clientId, dueDate: today, actionType: "call" });
      await ctx.db.delete(clientId);
    });

    const result = await t.query(api.followUps.listToday, { today });
    expect(result.today).toHaveLength(0);
  });

  test("rechaza today malformado", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.followUps.listToday, { today: "no-es-una-fecha" })).rejects.toThrow();
  });

  test("rechaza today con año fuera del rango permitido", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.followUps.listToday, { today: "0099-01-01" })).rejects.toThrow();
  });

  test("un backlog de atrasados por encima del límite no oculta los de hoy (ronda 2)", async () => {
    const t = convexTest(schema, modules);
    const today = "2026-08-08";
    await t.run(async (ctx) => {
      for (let i = 0; i < LIMIT + 5; i++) {
        const clientId = await ctx.db.insert("clients", { name: `Atrasado ${i}` });
        await ctx.db.insert("followUps", { clientId, dueDate: "2020-01-01", actionType: "call" });
      }
      const todayClient = await ctx.db.insert("clients", { name: "Hoy Visible" });
      await ctx.db.insert("followUps", { clientId: todayClient, dueDate: today, actionType: "call" });
    });

    const result = await t.query(api.followUps.listToday, { today });
    expect(result.overdueTruncated).toBe(true);
    expect(result.overdue).toHaveLength(LIMIT);
    expect(result.todayTruncated).toBe(false);
    expect(result.today).toHaveLength(1);
    expect(result.today[0].clientName).toBe("Hoy Visible");
  }, 30000);

  test("búsqueda cuya única coincidencia cae fuera de la ventana truncada marca todayTruncated (ronda 3)", async () => {
    const t = convexTest(schema, modules);
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

    const result = await t.query(api.followUps.listToday, { today, search: "Objetivo" });
    expect(result.todayTruncated).toBe(true);
    // El objetivo real existe pero queda fuera de la ventana truncada: el
    // array filtrado queda vacío. Esto es justo lo que HoyScreen/
    // deriveHoyViewState debe distinguir de un "Sin resultados" real.
    expect(result.today).toHaveLength(0);
  }, 30000);
});
