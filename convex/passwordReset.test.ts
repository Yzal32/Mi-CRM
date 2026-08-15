import { convexTest, type TestConvex } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { createUser } from "./model/users";
import { createPasswordReset } from "./model/passwordReset";

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

async function provisionUser(
  t: TestConvex<typeof schema>,
  overrides: { email?: string; password?: string; status?: "active" | "inactive" } = {},
) {
  const email = overrides.email ?? "marta@ejemplo.com";
  const password = overrides.password ?? "actual12345";
  const userId = await t.run((ctx) =>
    createUser(ctx, { name: "Marta Gómez", email, password, role: "owner", mustChangePassword: false }),
  );
  if (overrides.status === "inactive") {
    await t.run((ctx) => ctx.db.patch(userId, { status: "inactive" }));
  }
  return { userId, email, password };
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

describe("passwordReset.resetPassword", () => {
  test("token válido: cambia el hash, desmarca mustChangePassword, revoca sesiones viejas, el token deja de servir", async () => {
    const t = convexTest(schema, modules);
    const { userId, email, password } = await provisionUser(t);
    const oldSession = await t.mutation(api.sessions.login, { email, password });
    const token = await t.run((ctx) => createPasswordReset(ctx, userId));
    const hashBefore = await passwordHashOf(t, email);

    await t.mutation(api.passwordReset.resetPassword, { token, newPassword: "nuevaPass123" });

    const hashAfter = await passwordHashOf(t, email);
    expect(hashAfter).not.toBe(hashBefore);
    expect(await t.query(api.sessions.verify, { token: oldSession.token })).toBeNull();

    const login = await t.mutation(api.sessions.login, { email, password: "nuevaPass123" });
    expect(login.mustChangePassword).toBe(false);

    // Token consumido: reutilizarlo falla.
    const error = await captureError(t.mutation(api.passwordReset.resetPassword, { token, newPassword: "otraPass456" }));
    expect(error.data.code).toBe("RESET_TOKEN_INVALID");
  });

  test("token con formato inválido -> RESET_TOKEN_INVALID", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.mutation(api.passwordReset.resetPassword, { token: "no-es-un-token", newPassword: "nuevaPass123" }),
    );
    expect(error.data.code).toBe("RESET_TOKEN_INVALID");
  });

  test("token caducado -> RESET_TOKEN_INVALID", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await provisionUser(t);
    const token = await t.run((ctx) => createPasswordReset(ctx, userId));
    await t.run(async (ctx) => {
      const reset = await ctx.db
        .query("passwordResets")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
      await ctx.db.patch(reset!._id, { expiresAt: Date.now() - 1000 });
    });

    const error = await captureError(t.mutation(api.passwordReset.resetPassword, { token, newPassword: "nuevaPass123" }));
    expect(error.data.code).toBe("RESET_TOKEN_INVALID");
  });

  test("contraseña nueva demasiado corta -> PASSWORD_TOO_SHORT, el token no se consume", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await provisionUser(t);
    const token = await t.run((ctx) => createPasswordReset(ctx, userId));

    const error = await captureError(t.mutation(api.passwordReset.resetPassword, { token, newPassword: "corta" }));
    expect(error.data.code).toBe("PASSWORD_TOO_SHORT");

    // Falló antes de consumir el token: sigue disponible, no da RESET_TOKEN_INVALID.
    const secondError = await captureError(t.mutation(api.passwordReset.resetPassword, { token, newPassword: "corta" }));
    expect(secondError.data.code).toBe("PASSWORD_TOO_SHORT");
  });

  test("usar un token invalida también cualquier otro token pendiente del mismo usuario", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await provisionUser(t);
    const tokenA = await t.run((ctx) => createPasswordReset(ctx, userId));
    const tokenB = await t.run((ctx) => createPasswordReset(ctx, userId));

    await t.mutation(api.passwordReset.resetPassword, { token: tokenA, newPassword: "nuevaPass123" });

    const error = await captureError(t.mutation(api.passwordReset.resetPassword, { token: tokenB, newPassword: "otraPass456" }));
    expect(error.data.code).toBe("RESET_TOKEN_INVALID");
  });
});

describe("passwordReset.createResetForEmail", () => {
  test("email de una cuenta activa -> devuelve token y crea la fila", async () => {
    const t = convexTest(schema, modules);
    const { email } = await provisionUser(t);

    const result = await t.mutation(internal.passwordReset.createResetForEmail, { email });
    expect(result).not.toBeNull();
    expect(result!.email).toBe(email);

    const resets = await t.run((ctx) => ctx.db.query("passwordResets").collect());
    expect(resets).toHaveLength(1);
  });

  test("email inexistente -> null, sin fila creada", async () => {
    const t = convexTest(schema, modules);
    const result = await t.mutation(internal.passwordReset.createResetForEmail, { email: "no-existe@ejemplo.com" });
    expect(result).toBeNull();
    const resets = await t.run((ctx) => ctx.db.query("passwordResets").collect());
    expect(resets).toHaveLength(0);
  });

  test("cuenta inactiva -> null, sin fila creada (mismo trato que inexistente)", async () => {
    const t = convexTest(schema, modules);
    const { email } = await provisionUser(t, { status: "inactive" });
    const result = await t.mutation(internal.passwordReset.createResetForEmail, { email });
    expect(result).toBeNull();
    const resets = await t.run((ctx) => ctx.db.query("passwordResets").collect());
    expect(resets).toHaveLength(0);
  });
});

describe("passwordReset.requestPasswordReset", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("el host del enlace enviado sale siempre de APP_URL — la action no acepta ningún argumento capaz de sustituirlo", async () => {
    vi.stubEnv("APP_URL", "https://mi-crm-production-d80f.up.railway.app");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    const t = convexTest(schema, modules);
    await provisionUser(t, { email: "victima@ejemplo.com" });

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-id" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await t.action(api.passwordReset.requestPasswordReset, { email: "victima@ejemplo.com" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string) as { html: string };
    expect(body.html).toContain("https://mi-crm-production-d80f.up.railway.app/restablecer-contrasena/");
  });

  test("sin APP_URL configurada -> APP_URL_NOT_CONFIGURED, igual para un email existente que para uno inexistente", async () => {
    vi.stubEnv("APP_URL", "");
    const t = convexTest(schema, modules);
    await provisionUser(t, { email: "existe@ejemplo.com" });

    const errorExisting = await captureError(t.action(api.passwordReset.requestPasswordReset, { email: "existe@ejemplo.com" }));
    const errorMissing = await captureError(
      t.action(api.passwordReset.requestPasswordReset, { email: "no-existe@ejemplo.com" }),
    );
    expect(errorExisting.data.code).toBe("APP_URL_NOT_CONFIGURED");
    expect(errorMissing.data.code).toBe("APP_URL_NOT_CONFIGURED");
  });

  test("APP_URL malformada (sin esquema http/https) -> APP_URL_NOT_CONFIGURED", async () => {
    vi.stubEnv("APP_URL", "no-es-una-url");
    const t = convexTest(schema, modules);
    const error = await captureError(t.action(api.passwordReset.requestPasswordReset, { email: "cualquiera@ejemplo.com" }));
    expect(error.data.code).toBe("APP_URL_NOT_CONFIGURED");
  });
});
