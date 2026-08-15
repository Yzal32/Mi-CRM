import { convexTest, type TestConvex } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { createUser } from "./model/users";
import { createPasswordReset } from "./model/passwordReset";

const modules = import.meta.glob("./**/*.ts");
const PEPPER = "test-pepper-1234567890";

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

async function createCode(t: TestConvex<typeof schema>, userId: Parameters<typeof createPasswordReset>[1]["userId"]) {
  const code = await t.run((ctx) => createPasswordReset(ctx, { userId, pepper: PEPPER }));
  return code!;
}

async function resetRowOf(t: TestConvex<typeof schema>, userId: Parameters<typeof createPasswordReset>[1]["userId"]) {
  return t.run((ctx) =>
    ctx.db
      .query("passwordResets")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique(),
  );
}

describe("passwordReset.resetPassword", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("código válido: cambia el hash, desmarca mustChangePassword, revoca sesiones viejas, el código deja de servir", async () => {
    vi.stubEnv("PASSWORD_RESET_CODE_PEPPER", PEPPER);
    const t = convexTest(schema, modules);
    const { userId, email, password } = await provisionUser(t);
    const oldSession = await t.mutation(api.sessions.login, { email, password });
    const code = await createCode(t, userId);
    const hashBefore = await passwordHashOf(t, email);

    await t.action(api.passwordReset.resetPassword, { email, code, newPassword: "nuevaPass123" });

    const hashAfter = await passwordHashOf(t, email);
    expect(hashAfter).not.toBe(hashBefore);
    expect(await t.query(api.sessions.verify, { token: oldSession.token })).toBeNull();

    const login = await t.mutation(api.sessions.login, { email, password: "nuevaPass123" });
    expect(login.mustChangePassword).toBe(false);

    // Código consumido: reutilizarlo falla.
    const error = await captureError(t.action(api.passwordReset.resetPassword, { email, code, newPassword: "otraPass456" }));
    expect(error.data.code).toBe("RESET_CODE_INVALID");
  });

  test("código con formato inválido (no son 6 dígitos) -> RESET_CODE_INVALID", async () => {
    vi.stubEnv("PASSWORD_RESET_CODE_PEPPER", PEPPER);
    const t = convexTest(schema, modules);
    const { email } = await provisionUser(t);
    const error = await captureError(
      t.action(api.passwordReset.resetPassword, { email, code: "12a45", newPassword: "nuevaPass123" }),
    );
    expect(error.data.code).toBe("RESET_CODE_INVALID");
  });

  test("código caducado -> RESET_CODE_INVALID", async () => {
    vi.stubEnv("PASSWORD_RESET_CODE_PEPPER", PEPPER);
    const t = convexTest(schema, modules);
    const { userId, email } = await provisionUser(t);
    const code = await createCode(t, userId);
    await t.run(async (ctx) => {
      const reset = await ctx.db
        .query("passwordResets")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
      await ctx.db.patch(reset!._id, { expiresAt: Date.now() - 1000 });
    });

    const error = await captureError(t.action(api.passwordReset.resetPassword, { email, code, newPassword: "nuevaPass123" }));
    expect(error.data.code).toBe("RESET_CODE_INVALID");
  });

  test("código incorrecto incrementa attempts (se comita aunque la action termine fallando) sin consumir el código correcto", async () => {
    vi.stubEnv("PASSWORD_RESET_CODE_PEPPER", PEPPER);
    const t = convexTest(schema, modules);
    const { userId, email } = await provisionUser(t);
    const code = await createCode(t, userId);
    const wrongCode = code === "000000" ? "999999" : "000000";

    const error = await captureError(
      t.action(api.passwordReset.resetPassword, { email, code: wrongCode, newPassword: "nuevaPass123" }),
    );
    expect(error.data.code).toBe("RESET_CODE_INVALID");
    const row = await resetRowOf(t, userId);
    expect(row!.attempts).toBe(1);

    // El código correcto todavía funciona (no se ha agotado con 1 fallo).
    await t.action(api.passwordReset.resetPassword, { email, code, newPassword: "nuevaPass123" });
    const login = await t.mutation(api.sessions.login, { email, password: "nuevaPass123" });
    expect(login.mustChangePassword).toBe(false);
  });

  test("al 5º intento fallido el código queda inservible aunque el 6º sea el correcto", async () => {
    vi.stubEnv("PASSWORD_RESET_CODE_PEPPER", PEPPER);
    const t = convexTest(schema, modules);
    const { userId, email } = await provisionUser(t);
    const code = await createCode(t, userId);
    const wrongCode = code === "111111" ? "222222" : "111111";

    for (let i = 0; i < 5; i++) {
      await captureError(t.action(api.passwordReset.resetPassword, { email, code: wrongCode, newPassword: "nuevaPass123" }));
    }

    const row = await resetRowOf(t, userId);
    expect(row!.attempts).toBe(5);

    // El código correcto ya no sirve: la fila está agotada, no borrada.
    const error = await captureError(t.action(api.passwordReset.resetPassword, { email, code, newPassword: "nuevaPass123" }));
    expect(error.data.code).toBe("RESET_CODE_INVALID");
  });

  test("email inexistente -> mismo RESET_CODE_INVALID genérico que un código incorrecto", async () => {
    vi.stubEnv("PASSWORD_RESET_CODE_PEPPER", PEPPER);
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.action(api.passwordReset.resetPassword, { email: "no-existe@ejemplo.com", code: "123456", newPassword: "nuevaPass123" }),
    );
    expect(error.data.code).toBe("RESET_CODE_INVALID");
  });

  test("sin PASSWORD_RESET_CODE_PEPPER configurado -> PASSWORD_RESET_NOT_CONFIGURED", async () => {
    vi.stubEnv("PASSWORD_RESET_CODE_PEPPER", "");
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.action(api.passwordReset.resetPassword, { email: "cualquiera@ejemplo.com", code: "123456", newPassword: "nuevaPass123" }),
    );
    expect(error.data.code).toBe("PASSWORD_RESET_NOT_CONFIGURED");
  });

  test("un código generado con un pepper no verifica con otro pepper (confirma HMAC real, no un hash fijo)", async () => {
    const t = convexTest(schema, modules);
    const { userId, email } = await provisionUser(t);
    const code = await t.run((ctx) => createPasswordReset(ctx, { userId, pepper: "pepper-A" }));

    vi.stubEnv("PASSWORD_RESET_CODE_PEPPER", "pepper-B");
    const error = await captureError(t.action(api.passwordReset.resetPassword, { email, code: code!, newPassword: "nuevaPass123" }));
    expect(error.data.code).toBe("RESET_CODE_INVALID");

    // Con el pepper correcto (el usado al generarlo), el mismo código sí funciona.
    vi.stubEnv("PASSWORD_RESET_CODE_PEPPER", "pepper-A");
    await t.action(api.passwordReset.resetPassword, { email, code: code!, newPassword: "nuevaPass123" });
    const login = await t.mutation(api.sessions.login, { email, password: "nuevaPass123" });
    expect(login.mustChangePassword).toBe(false);
  });
});

describe("passwordReset.createResetForEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("email de una cuenta activa -> devuelve código y crea la fila", async () => {
    vi.stubEnv("PASSWORD_RESET_CODE_PEPPER", PEPPER);
    const t = convexTest(schema, modules);
    const { email } = await provisionUser(t);

    const result = await t.mutation(internal.passwordReset.createResetForEmail, { email });
    expect(result).not.toBeNull();
    expect(result!.email).toBe(email);
    expect(result!.code).toMatch(/^\d{6}$/);

    const resets = await t.run((ctx) => ctx.db.query("passwordResets").collect());
    expect(resets).toHaveLength(1);
  });

  test("email inexistente -> null, sin fila creada", async () => {
    vi.stubEnv("PASSWORD_RESET_CODE_PEPPER", PEPPER);
    const t = convexTest(schema, modules);
    const result = await t.mutation(internal.passwordReset.createResetForEmail, { email: "no-existe@ejemplo.com" });
    expect(result).toBeNull();
    const resets = await t.run((ctx) => ctx.db.query("passwordResets").collect());
    expect(resets).toHaveLength(0);
  });

  test("cuenta inactiva -> null, sin fila creada (mismo trato que inexistente)", async () => {
    vi.stubEnv("PASSWORD_RESET_CODE_PEPPER", PEPPER);
    const t = convexTest(schema, modules);
    const { email } = await provisionUser(t, { status: "inactive" });
    const result = await t.mutation(internal.passwordReset.createResetForEmail, { email });
    expect(result).toBeNull();
    const resets = await t.run((ctx) => ctx.db.query("passwordResets").collect());
    expect(resets).toHaveLength(0);
  });

  test("sin PASSWORD_RESET_CODE_PEPPER configurado -> PASSWORD_RESET_NOT_CONFIGURED, igual para email existente e inexistente", async () => {
    vi.stubEnv("PASSWORD_RESET_CODE_PEPPER", "");
    const t = convexTest(schema, modules);
    await provisionUser(t, { email: "existe@ejemplo.com" });

    const errorExisting = await captureError(t.mutation(internal.passwordReset.createResetForEmail, { email: "existe@ejemplo.com" }));
    const errorMissing = await captureError(
      t.mutation(internal.passwordReset.createResetForEmail, { email: "no-existe@ejemplo.com" }),
    );
    expect(errorExisting.data.code).toBe("PASSWORD_RESET_NOT_CONFIGURED");
    expect(errorMissing.data.code).toBe("PASSWORD_RESET_NOT_CONFIGURED");
  });
});

describe("passwordReset.createPasswordReset — margen entre solicitudes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("pedir un código nuevo antes del margen -> null, no sustituye al existente", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await provisionUser(t);

    const first = await t.run((ctx) => createPasswordReset(ctx, { userId, pepper: PEPPER }));
    expect(first).not.toBeNull();

    const second = await t.run((ctx) => createPasswordReset(ctx, { userId, pepper: PEPPER }));
    expect(second).toBeNull();

    const resets = await t.run((ctx) => ctx.db.query("passwordResets").collect());
    expect(resets).toHaveLength(1);
  });

  test("pedir un código nuevo después del margen -> sustituye al anterior", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await provisionUser(t);

    await createCode(t, userId);
    await t.run(async (ctx) => {
      const reset = await ctx.db
        .query("passwordResets")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
      await ctx.db.patch(reset!._id, { createdAt: Date.now() - 61_000 });
    });

    const replacement = await t.run((ctx) => createPasswordReset(ctx, { userId, pepper: PEPPER }));
    expect(replacement).not.toBeNull();

    const resets = await t.run((ctx) => ctx.db.query("passwordResets").collect());
    expect(resets).toHaveLength(1);
  });

  test("resuelve B2: tras agotar los 5 intentos, pedir un código nuevo de inmediato devuelve null (no sustituye la fila agotada)", async () => {
    vi.stubEnv("PASSWORD_RESET_CODE_PEPPER", PEPPER);
    const t = convexTest(schema, modules);
    const { userId, email } = await provisionUser(t);
    const code = await createCode(t, userId);
    const wrongCode = code === "111111" ? "222222" : "111111";

    for (let i = 0; i < 5; i++) {
      await captureError(t.action(api.passwordReset.resetPassword, { email, code: wrongCode, newPassword: "nuevaPass123" }));
    }

    // Solicitud inmediata: la fila agotada sigue teniendo su createdAt original,
    // así que el margen de 1 minuto sigue aplicando — no se emite un código nuevo.
    const immediate = await t.run((ctx) => createPasswordReset(ctx, { userId, pepper: PEPPER }));
    expect(immediate).toBeNull();

    // Solo tras esperar el margen (simulado) se sustituye por una nueva utilizable.
    await t.run(async (ctx) => {
      const reset = await ctx.db
        .query("passwordResets")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
      await ctx.db.patch(reset!._id, { createdAt: Date.now() - 61_000 });
    });
    const afterWait = await t.run((ctx) => createPasswordReset(ctx, { userId, pepper: PEPPER }));
    expect(afterWait).not.toBeNull();

    const row = await resetRowOf(t, userId);
    expect(row!.attempts).toBe(0);
  });
});
