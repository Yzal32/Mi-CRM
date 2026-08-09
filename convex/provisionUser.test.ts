import { compareSync } from "bcryptjs";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("users.provisionUser", () => {
  test("crea el usuario con mustChangePassword: true, sin que el caller lo decida", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(internal.users.provisionUser, {
      name: "Marta Gómez",
      email: "marta@ejemplo.com",
      password: "contraseña-temporal",
      role: "owner",
    });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.mustChangePassword).toBe(true);
    expect(doc?.role).toBe("owner");
    expect(doc?.status).toBe("active");
    expect(compareSync("contraseña-temporal", doc!.passwordHash)).toBe(true);
  });

  test("rechaza un role que no sea 'owner' ni 'employee' en la propia validación de argumentos", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.users.provisionUser, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-temporal",
        role: "admin",
      } as never),
    ).rejects.toThrow();
  });
});
