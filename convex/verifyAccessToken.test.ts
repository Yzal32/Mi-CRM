import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { createUser } from "./model/users";
import { issueAccessToken, login, verifyAccessToken } from "./model/sessions";

const modules = import.meta.glob("./**/*.ts");

const EMAIL = "marta@ejemplo.com";
const PASSWORD = "contraseña-valida";

async function setup(t: TestConvex<typeof schema>): Promise<{ accessToken: string }> {
  await createUserAndLogin(t);
  const { token: sessionToken } = await t.run((ctx) => login(ctx, { email: EMAIL, password: PASSWORD }));
  const { accessToken } = await t.run((ctx) => issueAccessToken(ctx, sessionToken));
  return { accessToken };
}

async function createUserAndLogin(t: TestConvex<typeof schema>): Promise<void> {
  await t.run((ctx) =>
    createUser(ctx, { name: "Marta Gómez", email: EMAIL, password: PASSWORD, role: "owner", mustChangePassword: false }),
  );
}

describe("verifyAccessToken", () => {
  test("token recién emitido verifica y devuelve el usuario", async () => {
    const t = convexTest(schema, modules);
    const { accessToken } = await setup(t);

    const verified = await t.run((ctx) => verifyAccessToken(ctx, accessToken));
    expect(verified?.email).toBe(EMAIL);
    expect(verified?.name).toBe("Marta Gómez");
  });

  test("formato inválido -> null", async () => {
    const t = convexTest(schema, modules);
    expect(await t.run((ctx) => verifyAccessToken(ctx, "no-es-hex"))).toBeNull();
    expect(await t.run((ctx) => verifyAccessToken(ctx, ""))).toBeNull();
    expect(await t.run((ctx) => verifyAccessToken(ctx, "a".repeat(63)))).toBeNull();
  });

  test("token inexistente (formato válido) -> null", async () => {
    const t = convexTest(schema, modules);
    expect(await t.run((ctx) => verifyAccessToken(ctx, "a".repeat(64)))).toBeNull();
  });

  test("token expirado -> null, y NO borra la fila (de solo lectura)", async () => {
    const t = convexTest(schema, modules);
    const { accessToken } = await setup(t);
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("accessTokens").collect();
      await ctx.db.patch(rows[0]._id, { expiresAt: Date.now() - 1 });
    });

    expect(await t.run((ctx) => verifyAccessToken(ctx, accessToken))).toBeNull();
    const rows = await t.run((ctx) => ctx.db.query("accessTokens").collect());
    expect(rows).toHaveLength(1);
  });

  test("sesión padre borrada directamente -> null", async () => {
    const t = convexTest(schema, modules);
    const { accessToken } = await setup(t);
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("sessions").collect();
      await ctx.db.delete(rows[0]._id);
    });

    expect(await t.run((ctx) => verifyAccessToken(ctx, accessToken))).toBeNull();
  });

  test("cuenta pasada a inactive después de emitir el token -> null", async () => {
    const t = convexTest(schema, modules);
    const { accessToken } = await setup(t);
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", EMAIL)).unique();
      await ctx.db.patch(user!._id, { status: "inactive" });
    });

    expect(await t.run((ctx) => verifyAccessToken(ctx, accessToken))).toBeNull();
  });

  test("mustChangePassword pasa a true después de emitir el token -> se invalida", async () => {
    const t = convexTest(schema, modules);
    const { accessToken } = await setup(t);
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", EMAIL)).unique();
      await ctx.db.patch(user!._id, { mustChangePassword: true });
    });

    expect(await t.run((ctx) => verifyAccessToken(ctx, accessToken))).toBeNull();
  });
});
