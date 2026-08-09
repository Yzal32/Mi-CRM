import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { createUser } from "./model/users";

const modules = import.meta.glob("./**/*.ts");

async function makeActiveUser(t: TestConvex<typeof schema>) {
  await t.run((ctx) =>
    createUser(ctx, {
      name: "Marta Gómez",
      email: "marta@ejemplo.com",
      password: "contraseña-valida",
      role: "owner",
      mustChangePassword: false,
    }),
  );
}

describe("sessions (capa pública)", () => {
  test("login devuelve un DTO sin passwordHash", async () => {
    const t = convexTest(schema, modules);
    await makeActiveUser(t);
    const result = await t.mutation(api.sessions.login, { email: "marta@ejemplo.com", password: "contraseña-valida" });
    expect(result).not.toHaveProperty("passwordHash");
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.name).toBe("Marta Gómez");
    expect(result.role).toBe("owner");
    expect(result.mustChangePassword).toBe(false);
  });

  test("verify incluye userId y el resto de datos, sin passwordHash", async () => {
    const t = convexTest(schema, modules);
    await makeActiveUser(t);
    const { token } = await t.mutation(api.sessions.login, { email: "marta@ejemplo.com", password: "contraseña-valida" });

    const verified = await t.query(api.sessions.verify, { token });
    expect(verified).not.toBeNull();
    expect(verified).not.toHaveProperty("passwordHash");
    expect(verified?.userId).toBeDefined();
    expect(verified?.email).toBe("marta@ejemplo.com");
  });

  test("verify con un token que no existe devuelve null", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.sessions.verify, { token: "a".repeat(64) })).toBeNull();
  });

  test("logout borra la sesión", async () => {
    const t = convexTest(schema, modules);
    await makeActiveUser(t);
    const { token } = await t.mutation(api.sessions.login, { email: "marta@ejemplo.com", password: "contraseña-valida" });

    await t.mutation(api.sessions.logout, { token });

    expect(await t.query(api.sessions.verify, { token })).toBeNull();
  });

  test("logout con un token desconocido no lanza error", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.sessions.logout, { token: "a".repeat(64) })).resolves.toBeNull();
  });
});
