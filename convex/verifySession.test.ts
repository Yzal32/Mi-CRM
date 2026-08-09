import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { createUser } from "./model/users";
import { login, verifySession } from "./model/sessions";

const modules = import.meta.glob("./**/*.ts");

describe("verifySession", () => {
  test("token válido devuelve el usuario", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-valida",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const { token } = await t.run((ctx) => login(ctx, { email: "carlos@ejemplo.com", password: "contraseña-valida" }));

    const verified = await t.run((ctx) => verifySession(ctx, token));
    expect(verified?.email).toBe("carlos@ejemplo.com");
    expect(verified?.name).toBe("Carlos Ruiz");
    expect(verified?.role).toBe("employee");
    expect(verified?.mustChangePassword).toBe(false);
  });

  test("token inexistente (pero con formato válido) devuelve null", async () => {
    const t = convexTest(schema, modules);
    expect(await t.run((ctx) => verifySession(ctx, "a".repeat(64)))).toBeNull();
  });

  test("token vacío o con formato inválido devuelve null sin lanzar", async () => {
    const t = convexTest(schema, modules);
    expect(await t.run((ctx) => verifySession(ctx, ""))).toBeNull();
    expect(await t.run((ctx) => verifySession(ctx, "no-es-hex"))).toBeNull();
    expect(await t.run((ctx) => verifySession(ctx, "a".repeat(63)))).toBeNull();
  });

  test("cuenta puesta a inactiva después de crear la sesión deja de verificar", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-valida",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const { token } = await t.run((ctx) => login(ctx, { email: "carlos@ejemplo.com", password: "contraseña-valida" }));

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", "carlos@ejemplo.com"))
        .unique();
      await ctx.db.patch(user!._id, { status: "inactive" });
    });

    expect(await t.run((ctx) => verifySession(ctx, token))).toBeNull();
  });
});
