import { convexTest, type TestConvex } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { createUser } from "./model/users";
import { ACCESS_TOKEN_TTL_MS, MAX_ACCESS_TOKENS_PER_SESSION, issueAccessToken, login, verifyAccessToken } from "./model/sessions";

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
  overrides: { mustChangePassword?: boolean } = {},
): Promise<{ email: string; password: string }> {
  const email = "marta@ejemplo.com";
  const password = "contraseña-valida";
  await t.run((ctx) =>
    createUser(ctx, { name: "Marta Gómez", email, password, role: "owner", mustChangePassword: overrides.mustChangePassword ?? false }),
  );
  return { email, password };
}

describe("issueAccessToken", () => {
  test("token de sesión válido emite un accessToken con formato hex-64", async () => {
    const t = convexTest(schema, modules);
    const { email, password } = await makeActiveUser(t);
    const { token: sessionToken } = await t.run((ctx) => login(ctx, { email, password }));

    const result = await t.run((ctx) => issueAccessToken(ctx, sessionToken));
    expect(result.accessToken).toMatch(/^[0-9a-f]{64}$/);
  });

  test("expiresAt y serverNow provienen del mismo instante (expiresAt = serverNow + TTL)", async () => {
    const t = convexTest(schema, modules);
    const { email, password } = await makeActiveUser(t);
    const { token: sessionToken } = await t.run((ctx) => login(ctx, { email, password }));

    const result = await t.run((ctx) => issueAccessToken(ctx, sessionToken));
    expect(result.expiresAt).toBe(result.serverNow + ACCESS_TOKEN_TTL_MS);
  });

  test("token de sesión inválido -> SESSION_INVALID, sin emitir nada", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(t.run((ctx) => issueAccessToken(ctx, "a".repeat(64))));
    expect(error.data.code).toBe("SESSION_INVALID");
    expect(await t.run((ctx) => ctx.db.query("accessTokens").collect())).toHaveLength(0);
  });

  test("mustChangePassword: true -> PASSWORD_CHANGE_REQUIRED, sin emitir nada", async () => {
    const t = convexTest(schema, modules);
    const { email, password } = await makeActiveUser(t, { mustChangePassword: true });
    const { token: sessionToken } = await t.run((ctx) => login(ctx, { email, password }));

    const error = await captureError(t.run((ctx) => issueAccessToken(ctx, sessionToken)));
    expect(error.data.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(await t.run((ctx) => ctx.db.query("accessTokens").collect())).toHaveLength(0);
  });

  test(`orden de limpieza: con ${MAX_ACCESS_TOKENS_PER_SESSION} activos, el siguiente desaloja al más antiguo de los ${MAX_ACCESS_TOKENS_PER_SESSION}`, async () => {
    const t = convexTest(schema, modules);
    const { email, password } = await makeActiveUser(t);
    const { token: sessionToken } = await t.run((ctx) => login(ctx, { email, password }));

    const issued: string[] = [];
    for (let i = 0; i < MAX_ACCESS_TOKENS_PER_SESSION; i++) {
      const result = await t.run((ctx) => issueAccessToken(ctx, sessionToken));
      issued.push(result.accessToken);
    }
    const nth = await t.run((ctx) => issueAccessToken(ctx, sessionToken));

    // El más antiguo de los 8 (el primero emitido) queda desalojado.
    expect(await t.run((ctx) => verifyAccessToken(ctx, issued[0]))).toBeNull();
    // Los otros 7 originales y el recién emitido siguen vigentes.
    for (const token of issued.slice(1)) {
      expect(await t.run((ctx) => verifyAccessToken(ctx, token))).not.toBeNull();
    }
    expect(await t.run((ctx) => verifyAccessToken(ctx, nth.accessToken))).not.toBeNull();
  });

  test("limpia físicamente los accessTokens ya expirados de esa sesión", async () => {
    const t = convexTest(schema, modules);
    const { email, password } = await makeActiveUser(t);
    const { token: sessionToken } = await t.run((ctx) => login(ctx, { email, password }));

    await t.run((ctx) => issueAccessToken(ctx, sessionToken));
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("accessTokens").collect();
      await ctx.db.patch(rows[0]._id, { expiresAt: Date.now() - 1 });
    });

    await t.run((ctx) => issueAccessToken(ctx, sessionToken));

    // El expirado se borró físicamente al emitir el segundo — solo queda 1 fila.
    const rows = await t.run((ctx) => ctx.db.query("accessTokens").collect());
    expect(rows).toHaveLength(1);
  });

  describe("expiración programada (ronda 6 de auditoría: reactividad de Convex)", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    test(
      "al cumplirse el TTL, el scheduler borra físicamente la fila — Convex solo reevalúa " +
        "una query en vivo cuando cambia un documento que leyó, nunca por el simple paso del " +
        "tiempo, así que esta escritura es lo que fuerza esa reevaluación",
      async () => {
        vi.useFakeTimers();
        const t = convexTest(schema, modules);
        const { email, password } = await makeActiveUser(t);
        const { token: sessionToken } = await t.run((ctx) => login(ctx, { email, password }));

        await t.run((ctx) => issueAccessToken(ctx, sessionToken));
        expect(await t.run((ctx) => ctx.db.query("accessTokens").collect())).toHaveLength(1);

        await t.finishAllScheduledFunctions(vi.runAllTimers);

        expect(await t.run((ctx) => ctx.db.query("accessTokens").collect())).toHaveLength(0);
      },
    );

    test("no falla si la fila ya no existe cuando el scheduler la ejecuta (sesión borrada, o token desalojado antes)", async () => {
      vi.useFakeTimers();
      const t = convexTest(schema, modules);
      const { email, password } = await makeActiveUser(t);
      const { token: sessionToken } = await t.run((ctx) => login(ctx, { email, password }));

      await t.run((ctx) => issueAccessToken(ctx, sessionToken));
      // Se borra por otro camino (p. ej. deleteSessionAndAccessTokens) antes
      // de que el scheduler llegue a ejecutarse.
      await t.run(async (ctx) => {
        const rows = await ctx.db.query("accessTokens").collect();
        for (const row of rows) await ctx.db.delete(row._id);
      });

      // No debe lanzar: expireAccessTokenIfDue comprueba existencia antes de
      // borrar (ctx.db.delete sobre un id ya borrado sí lanzaría).
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await t.run((ctx) => ctx.db.query("accessTokens").collect())).toHaveLength(0);
    });
  });
});
