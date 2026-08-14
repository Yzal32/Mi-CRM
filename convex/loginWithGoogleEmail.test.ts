import { convexTest, type TestConvex } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { createUser } from "./model/users";
import { loginWithGoogleEmail, verifySession } from "./model/sessions";

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

async function makeUser(
  t: TestConvex<typeof schema>,
  overrides: Partial<{ email: string; role: "owner" | "employee"; mustChangePassword: boolean }> = {},
) {
  const email = overrides.email ?? "marta@ejemplo.com";
  await t.run((ctx) =>
    createUser(ctx, {
      name: "Marta Gómez",
      email,
      password: "contraseña-valida",
      role: overrides.role ?? "owner",
      mustChangePassword: overrides.mustChangePassword ?? false,
    }),
  );
  return { email };
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

describe("loginWithGoogleEmail", () => {
  test("email de un usuario aprovisionado y activo -> devuelve token y datos del usuario", async () => {
    const t = convexTest(schema, modules);
    const { email } = await makeUser(t);
    const result = await t.run((ctx) => loginWithGoogleEmail(ctx, email));
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.name).toBe("Marta Gómez");
    expect(result.role).toBe("owner");
    expect(result.mustChangePassword).toBe(false);
    expect(await t.run((ctx) => verifySession(ctx, result.token))).not.toBeNull();
  });

  test("normaliza el email (espacios y mayúsculas) igual que el login por contraseña", async () => {
    const t = convexTest(schema, modules);
    const { email } = await makeUser(t, { email: "marta@ejemplo.com" });
    const result = await t.run((ctx) => loginWithGoogleEmail(ctx, "  Marta@Ejemplo.com  "));
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    void email;
  });

  test("email sin cuenta aprovisionada -> ACCOUNT_NOT_PROVISIONED, sin crear ningún usuario", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(t.run((ctx) => loginWithGoogleEmail(ctx, "no-existe@ejemplo.com")));
    expect(error.data.code).toBe("ACCOUNT_NOT_PROVISIONED");
    const user = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", "no-existe@ejemplo.com"))
        .unique(),
    );
    expect(user).toBeNull();
  });

  test("cuenta aprovisionada pero inactiva -> ACCOUNT_INACTIVE", async () => {
    const t = convexTest(schema, modules);
    const { email } = await makeUser(t);
    await deactivate(t, email);
    const error = await captureError(t.run((ctx) => loginWithGoogleEmail(ctx, email)));
    expect(error.data.code).toBe("ACCOUNT_INACTIVE");
  });

  test("cuenta con mustChangePassword pendiente -> igualmente crea sesión, devuelve el flag tal cual", async () => {
    const t = convexTest(schema, modules);
    const { email } = await makeUser(t, { mustChangePassword: true });
    const result = await t.run((ctx) => loginWithGoogleEmail(ctx, email));
    expect(result.mustChangePassword).toBe(true);
  });
});
