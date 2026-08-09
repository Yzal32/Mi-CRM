import { convexTest, type TestConvex } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { createUser } from "./model/users";
import { login, MAX_SESSIONS_PER_USER, verifySession } from "./model/sessions";

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

async function makeActiveUser(
  t: TestConvex<typeof schema>,
  overrides: Partial<{ email: string; password: string; role: "owner" | "employee" }> = {},
) {
  const email = overrides.email ?? "marta@ejemplo.com";
  const password = overrides.password ?? "contraseña-valida";
  await t.run((ctx) =>
    createUser(ctx, {
      name: "Marta Gómez",
      email,
      password,
      role: overrides.role ?? "owner",
      mustChangePassword: false,
    }),
  );
  return { email, password };
}

async function deactivate(t: TestConvex<typeof schema>, email: string) {
  await t.run(async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    await ctx.db.patch(user!._id, { status: "inactive" });
  });
}

describe("login", () => {
  test("credenciales correctas devuelven un token y los datos del usuario", async () => {
    const t = convexTest(schema, modules);
    const { email, password } = await makeActiveUser(t);
    const result = await t.run((ctx) => login(ctx, { email, password }));
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.name).toBe("Marta Gómez");
    expect(result.role).toBe("owner");
    expect(result.mustChangePassword).toBe(false);
  });

  test("dos logins seguidos generan tokens distintos", async () => {
    const t = convexTest(schema, modules);
    const { email, password } = await makeActiveUser(t);
    const first = await t.run((ctx) => login(ctx, { email, password }));
    const second = await t.run((ctx) => login(ctx, { email, password }));
    expect(first.token).not.toBe(second.token);
    expect(second.token).toMatch(/^[0-9a-f]{64}$/);
  });

  test("contraseña incorrecta -> INVALID_CREDENTIALS", async () => {
    const t = convexTest(schema, modules);
    const { email } = await makeActiveUser(t);
    const error = await captureError(t.run((ctx) => login(ctx, { email, password: "otra-cosa" })));
    expect(error.data.code).toBe("INVALID_CREDENTIALS");
  });

  test("email inexistente -> INVALID_CREDENTIALS (mismo código que contraseña incorrecta)", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.run((ctx) => login(ctx, { email: "no-existe@ejemplo.com", password: "cualquiera" })),
    );
    expect(error.data.code).toBe("INVALID_CREDENTIALS");
  });

  test("cuenta inactiva + contraseña correcta -> ACCOUNT_INACTIVE", async () => {
    const t = convexTest(schema, modules);
    const { email, password } = await makeActiveUser(t);
    await deactivate(t, email);
    const error = await captureError(t.run((ctx) => login(ctx, { email, password })));
    expect(error.data.code).toBe("ACCOUNT_INACTIVE");
  });

  test("cuenta inactiva + contraseña incorrecta -> INVALID_CREDENTIALS (el orden importa: no revela que está inactiva)", async () => {
    const t = convexTest(schema, modules);
    const { email } = await makeActiveUser(t);
    await deactivate(t, email);
    const error = await captureError(t.run((ctx) => login(ctx, { email, password: "mal" })));
    expect(error.data.code).toBe("INVALID_CREDENTIALS");
  });

  test("email por encima de la cota de tamaño -> INVALID_CREDENTIALS sin llegar a compareSync", async () => {
    const t = convexTest(schema, modules);
    const longEmail = `${"a".repeat(201)}@ejemplo.com`;
    const error = await captureError(t.run((ctx) => login(ctx, { email: longEmail, password: "cualquiera" })));
    expect(error.data.code).toBe("INVALID_CREDENTIALS");
  });

  test("contraseña por encima de la cota de tamaño -> INVALID_CREDENTIALS", async () => {
    const t = convexTest(schema, modules);
    const { email } = await makeActiveUser(t);
    const error = await captureError(t.run((ctx) => login(ctx, { email, password: "a".repeat(1001) })));
    expect(error.data.code).toBe("INVALID_CREDENTIALS");
  });

  test("contraseña de 73 bytes que comparte los primeros 72 con la real no autentica", async () => {
    const t = convexTest(schema, modules);
    const password = "a".repeat(72);
    const { email } = await makeActiveUser(t, { password });
    const error = await captureError(t.run((ctx) => login(ctx, { email, password: password + "b" })));
    expect(error.data.code).toBe("INVALID_CREDENTIALS");
  });

  test(`al superar ${MAX_SESSIONS_PER_USER} sesiones, la más antigua se revoca`, async () => {
    const t = convexTest(schema, modules);
    const { email, password } = await makeActiveUser(t);
    const tokens: string[] = [];
    for (let i = 0; i < MAX_SESSIONS_PER_USER; i++) {
      const result = await t.run((ctx) => login(ctx, { email, password }));
      tokens.push(result.token);
    }
    const oneMore = await t.run((ctx) => login(ctx, { email, password }));
    tokens.push(oneMore.token);

    expect(await t.run((ctx) => verifySession(ctx, tokens[0]))).toBeNull();
    for (const token of tokens.slice(1)) {
      expect(await t.run((ctx) => verifySession(ctx, token))).not.toBeNull();
    }
  });
});
