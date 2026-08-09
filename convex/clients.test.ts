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
