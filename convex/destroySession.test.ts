import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { createUser } from "./model/users";
import { destroySession, login, verifySession } from "./model/sessions";

const modules = import.meta.glob("./**/*.ts");

describe("destroySession", () => {
  test("tras destruir una sesión, su token deja de verificar", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      createUser(ctx, {
        name: "Marta Gómez",
        email: "marta@ejemplo.com",
        password: "contraseña-valida",
        role: "owner",
        mustChangePassword: false,
      }),
    );
    const { token } = await t.run((ctx) => login(ctx, { email: "marta@ejemplo.com", password: "contraseña-valida" }));

    await t.run((ctx) => destroySession(ctx, token));

    expect(await t.run((ctx) => verifySession(ctx, token))).toBeNull();
  });

  test("un token desconocido no lanza error (idempotente)", async () => {
    const t = convexTest(schema, modules);
    // t.run serializa un retorno `void`/undefined como null (misma
    // normalización que aplica Convex al valor de cualquier función) — lo
    // relevant aquí es que la promesa se resuelve sin lanzar.
    await expect(t.run((ctx) => destroySession(ctx, "a".repeat(64)))).resolves.toBeNull();
  });

  test("un token con formato inválido no lanza error", async () => {
    const t = convexTest(schema, modules);
    await expect(t.run((ctx) => destroySession(ctx, "no-es-hex"))).resolves.toBeNull();
  });
});
