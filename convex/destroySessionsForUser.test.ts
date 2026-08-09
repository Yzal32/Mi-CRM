import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { createUser } from "./model/users";
import { destroySessionsForUser, login, verifySession } from "./model/sessions";

const modules = import.meta.glob("./**/*.ts");

describe("destroySessionsForUser", () => {
  test("borra todas las sesiones del usuario, incluidas varias a la vez", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Marta Gómez",
        email: "marta@ejemplo.com",
        password: "contraseña-valida",
        role: "owner",
        mustChangePassword: false,
      }),
    );
    const first = await t.run((ctx) => login(ctx, { email: "marta@ejemplo.com", password: "contraseña-valida" }));
    const second = await t.run((ctx) => login(ctx, { email: "marta@ejemplo.com", password: "contraseña-valida" }));

    await t.run((ctx) => destroySessionsForUser(ctx, userId));

    expect(await t.run((ctx) => verifySession(ctx, first.token))).toBeNull();
    expect(await t.run((ctx) => verifySession(ctx, second.token))).toBeNull();
  });

  test("no afecta a las sesiones de otro usuario", async () => {
    const t = convexTest(schema, modules);
    const martaId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Marta Gómez",
        email: "marta@ejemplo.com",
        password: "contraseña-valida",
        role: "owner",
        mustChangePassword: false,
      }),
    );
    await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-valida",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const martaSession = await t.run((ctx) => login(ctx, { email: "marta@ejemplo.com", password: "contraseña-valida" }));
    const carlosSession = await t.run((ctx) => login(ctx, { email: "carlos@ejemplo.com", password: "contraseña-valida" }));

    await t.run((ctx) => destroySessionsForUser(ctx, martaId));

    expect(await t.run((ctx) => verifySession(ctx, martaSession.token))).toBeNull();
    expect(await t.run((ctx) => verifySession(ctx, carlosSession.token))).not.toBeNull();
  });
});
