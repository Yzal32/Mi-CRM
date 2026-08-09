import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("clients.create", () => {
  test("crea un cliente y devuelve su id", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.name).toBe("Carlos Ruiz");
    expect(doc?.status).toBe("new");
  });

  test("rechaza sin nombre, exponiendo el código en error.data.code", async () => {
    const t = convexTest(schema, modules);

    let caught: unknown;
    try {
      await t.mutation(api.clients.create, { name: "", phone: "622334556" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConvexError);
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("NAME_REQUIRED");
  });
});

describe("clients.getById", () => {
  test("devuelve el cliente por un id válido", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });

    const result = await t.query(api.clients.getById, { clientId: id });
    expect(result?.name).toBe("Carlos Ruiz");
  });

  test("devuelve null con un ID malformado, sin reventar el validador", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.clients.getById, { clientId: "no-es-un-id-valido" })).resolves.toBeNull();
  });

  test("devuelve null con un ID válido pero de un cliente borrado", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });
    await t.run((ctx) => ctx.db.delete(id));

    expect(await t.query(api.clients.getById, { clientId: id })).toBeNull();
  });

  test("el DTO no expone phoneKey, seedData ni seedKey", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });

    const result = await t.query(api.clients.getById, { clientId: id });
    expect(result).not.toHaveProperty("phoneKey");
    expect(result).not.toHaveProperty("seedData");
    expect(result).not.toHaveProperty("seedKey");
  });
});

describe("clients.updateStatus", () => {
  test("cambia el estado del cliente", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });

    await t.mutation(api.clients.updateStatus, { clientId: id, status: "won" });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.status).toBe("won");
  });

  test("CLIENT_NOT_FOUND con un cliente borrado", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });
    await t.run((ctx) => ctx.db.delete(id));

    let caught: unknown;
    try {
      await t.mutation(api.clients.updateStatus, { clientId: id, status: "won" });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("CLIENT_NOT_FOUND");
  });
});

describe("clients.update", () => {
  test("caso feliz: actualiza nombre, teléfono, email y canal de origen", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });

    await t.mutation(api.clients.update, {
      clientId: id,
      name: "Carlos R.",
      phone: "699111222",
      email: "carlos@ejemplo.com",
      originChannel: "referral",
    });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.name).toBe("Carlos R.");
    expect(doc?.phone).toBe("699111222");
    expect(doc?.email).toBe("carlos@ejemplo.com");
    expect(doc?.originChannel).toBe("referral");
  });

  test("CLIENT_NOT_FOUND con un cliente borrado", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });
    await t.run((ctx) => ctx.db.delete(id));

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { clientId: id, name: "Carlos Ruiz" });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("CLIENT_NOT_FOUND");
  });

  test("NAME_REQUIRED si se envía un nombre vacío", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { clientId: id, name: "   " });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("NAME_REQUIRED");
  });

  test("NAME_TOO_LONG si el nombre supera el máximo", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { clientId: id, name: "a".repeat(201) });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("NAME_TOO_LONG");
  });

  test("INVALID_PHONE si el teléfono enviado no es válido", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { clientId: id, phone: "abc" });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("INVALID_PHONE");
  });

  test("INVALID_EMAIL si el email enviado no es válido", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { clientId: id, email: "no-valido" });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("INVALID_EMAIL");
  });

  test("DUPLICATE_PHONE si el teléfono ya lo usa otro cliente", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.clients.create, { name: "Ana", phone: "600111222" });
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { clientId: id, phone: "600111222" });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("DUPLICATE_PHONE");
  });

  test("guardar el mismo teléfono reescrito con otro formato no choca contra sí mismo", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622 33 45 56" });

    await t.mutation(api.clients.update, { clientId: id, phone: "622334556" });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.phone).toBe("622334556");
  });

  test("omitir name conserva el nombre existente", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });

    await t.mutation(api.clients.update, { clientId: id, phone: "699111222" });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.name).toBe("Carlos Ruiz");
    expect(doc?.phone).toBe("699111222");
  });

  test("omitir phone/email/originChannel conserva sus valores existentes", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, {
      name: "Carlos Ruiz",
      phone: "622334556",
      email: "carlos@ejemplo.com",
      originChannel: "referral",
    });

    await t.mutation(api.clients.update, { clientId: id, name: "Carlos R." });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.name).toBe("Carlos R.");
    expect(doc?.phone).toBe("622334556");
    expect(doc?.email).toBe("carlos@ejemplo.com");
    expect(doc?.originChannel).toBe("referral");
  });

  test("omitir originChannel en un cliente con canal distinto de web lo conserva (no cae al default)", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, {
      name: "Carlos Ruiz",
      phone: "622334556",
      originChannel: "whatsapp",
    });

    await t.mutation(api.clients.update, { clientId: id, name: "Carlos R." });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.originChannel).toBe("whatsapp");
  });

  test("omitir los 4 campos a la vez no falla y no cambia nada (patch vacío)", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, { name: "Carlos Ruiz", phone: "622334556" });

    await t.mutation(api.clients.update, { clientId: id });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.name).toBe("Carlos Ruiz");
    expect(doc?.phone).toBe("622334556");
  });

  test("borrar el teléfono con email presente elimina phoneKey", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, {
      name: "Carlos Ruiz",
      phone: "622334556",
      email: "carlos@ejemplo.com",
    });

    await t.mutation(api.clients.update, { clientId: id, phone: "" });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.phone).toBeUndefined();
    expect(doc?.phoneKey).toBeUndefined();
    expect(doc?.email).toBe("carlos@ejemplo.com");
  });

  test("el teléfono liberado por un borrado se puede reutilizar en otro cliente", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, {
      name: "Carlos Ruiz",
      phone: "622334556",
      email: "carlos@ejemplo.com",
    });
    await t.mutation(api.clients.update, { clientId: id, phone: "" });

    const otherId = await t.mutation(api.clients.create, { name: "Ana", phone: "622334556" });

    const other = await t.run((ctx) => ctx.db.get(otherId));
    expect(other?.phone).toBe("622334556");
  });

  test("borrar teléfono y email a la vez rechaza con CONTACT_REQUIRED", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.clients.create, {
      name: "Carlos Ruiz",
      phone: "622334556",
      email: "carlos@ejemplo.com",
    });

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { clientId: id, phone: "", email: "" });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("CONTACT_REQUIRED");
  });
});
