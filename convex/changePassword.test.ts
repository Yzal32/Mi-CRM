import { convexTest, type TestConvex } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { createUser } from "./model/users";

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

async function provisionAndLogin(
  t: TestConvex<typeof schema>,
  overrides: { mustChangePassword?: boolean; password?: string } = {},
) {
  const password = overrides.password ?? "temporal123";
  await t.run((ctx) =>
    createUser(ctx, {
      name: "Marta Gómez",
      email: "marta@ejemplo.com",
      password,
      role: "owner",
      mustChangePassword: overrides.mustChangePassword ?? true,
    }),
  );
  const { token } = await t.mutation(api.sessions.login, { email: "marta@ejemplo.com", password });
  return { token, password };
}

async function passwordHashOf(t: TestConvex<typeof schema>, email: string) {
  return t.run(async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    return user!.passwordHash;
  });
}

describe("users.changePassword", () => {
  test("cambio correcto: desmarca mustChangePassword y la contraseña nueva funciona en un login posterior", async () => {
    const t = convexTest(schema, modules);
    const { token } = await provisionAndLogin(t);

    const result = await t.mutation(api.users.changePassword, {
      token,
      currentPassword: "temporal123",
      newPassword: "definitiva456",
    });
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);

    const nextLogin = await t.mutation(api.sessions.login, { email: "marta@ejemplo.com", password: "definitiva456" });
    expect(nextLogin.mustChangePassword).toBe(false);
  });

  test("rota la sesión: el token usado para cambiar deja de verificar, el nuevo sí", async () => {
    const t = convexTest(schema, modules);
    const { token } = await provisionAndLogin(t);

    const result = await t.mutation(api.users.changePassword, {
      token,
      currentPassword: "temporal123",
      newPassword: "definitiva456",
    });

    expect(await t.query(api.sessions.verify, { token })).toBeNull();
    const verifiedNew = await t.query(api.sessions.verify, { token: result.token });
    expect(verifiedNew?.email).toBe("marta@ejemplo.com");
  });

  test("una segunda sesión distinta del mismo usuario también queda revocada", async () => {
    const t = convexTest(schema, modules);
    const { token } = await provisionAndLogin(t);
    const otherSession = await t.mutation(api.sessions.login, { email: "marta@ejemplo.com", password: "temporal123" });

    await t.mutation(api.users.changePassword, { token, currentPassword: "temporal123", newPassword: "definitiva456" });

    expect(await t.query(api.sessions.verify, { token: otherSession.token })).toBeNull();
  });

  test("contraseña actual incorrecta -> CURRENT_PASSWORD_INCORRECT", async () => {
    const t = convexTest(schema, modules);
    const { token } = await provisionAndLogin(t);
    const error = await captureError(
      t.mutation(api.users.changePassword, { token, currentPassword: "mal", newPassword: "definitiva456" }),
    );
    expect(error.data.code).toBe("CURRENT_PASSWORD_INCORRECT");
  });

  test("contraseña actual de 73 bytes que comparte prefijo con la real -> CURRENT_PASSWORD_INCORRECT", async () => {
    const t = convexTest(schema, modules);
    const password = "a".repeat(72);
    const { token } = await provisionAndLogin(t, { password });

    const error = await captureError(
      t.mutation(api.users.changePassword, { token, currentPassword: password + "b", newPassword: "definitiva456" }),
    );
    expect(error.data.code).toBe("CURRENT_PASSWORD_INCORRECT");
  });

  test("newPassword === currentPassword -> PASSWORD_UNCHANGED, no cambia nada", async () => {
    const t = convexTest(schema, modules);
    const { token } = await provisionAndLogin(t);
    const hashBefore = await passwordHashOf(t, "marta@ejemplo.com");

    const error = await captureError(
      t.mutation(api.users.changePassword, { token, currentPassword: "temporal123", newPassword: "temporal123" }),
    );
    expect(error.data.code).toBe("PASSWORD_UNCHANGED");

    const hashAfter = await passwordHashOf(t, "marta@ejemplo.com");
    expect(hashAfter).toBe(hashBefore);

    const verified = await t.query(api.sessions.verify, { token });
    expect(verified?.mustChangePassword).toBe(true);
  });

  test("nueva contraseña demasiado corta -> PASSWORD_TOO_SHORT", async () => {
    const t = convexTest(schema, modules);
    const { token } = await provisionAndLogin(t);
    const error = await captureError(
      t.mutation(api.users.changePassword, { token, currentPassword: "temporal123", newPassword: "corta" }),
    );
    expect(error.data.code).toBe("PASSWORD_TOO_SHORT");
  });

  test("nueva contraseña de 1001 caracteres -> PASSWORD_TOO_LONG", async () => {
    const t = convexTest(schema, modules);
    const { token } = await provisionAndLogin(t);
    const error = await captureError(
      t.mutation(api.users.changePassword, { token, currentPassword: "temporal123", newPassword: "a".repeat(1001) }),
    );
    expect(error.data.code).toBe("PASSWORD_TOO_LONG");
  });

  test("token de sesión inválido -> SESSION_INVALID", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.mutation(api.users.changePassword, { token: "a".repeat(64), currentPassword: "x", newPassword: "definitiva456" }),
    );
    expect(error.data.code).toBe("SESSION_INVALID");
  });

  test("cambio voluntario (mustChangePassword ya en false) también funciona", async () => {
    const t = convexTest(schema, modules);
    const { token } = await provisionAndLogin(t, { mustChangePassword: false });
    const result = await t.mutation(api.users.changePassword, {
      token,
      currentPassword: "temporal123",
      newPassword: "definitiva456",
    });
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
  });
});
