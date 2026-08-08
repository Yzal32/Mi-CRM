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
