import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { createUser } from "./model/users";
import {
  MAX_SESSIONS_PER_USER,
  deleteSessionAndAccessTokens,
  destroySession,
  destroySessionsForUser,
  issueAccessToken,
  login,
  verifyAccessToken,
  verifySession,
} from "./model/sessions";

const modules = import.meta.glob("./**/*.ts");

const EMAIL = "marta@ejemplo.com";
const PASSWORD = "contraseña-valida";

async function makeActiveUser(t: TestConvex<typeof schema>): Promise<void> {
  await t.run((ctx) =>
    createUser(ctx, { name: "Marta Gómez", email: EMAIL, password: PASSWORD, role: "owner", mustChangePassword: false }),
  );
}

describe("deleteSessionAndAccessTokens", () => {
  test("borra la sesión y todos sus accessTokens asociados", async () => {
    const t = convexTest(schema, modules);
    await makeActiveUser(t);
    const { token: sessionToken } = await t.run((ctx) => login(ctx, { email: EMAIL, password: PASSWORD }));
    const first = await t.run((ctx) => issueAccessToken(ctx, sessionToken));
    const second = await t.run((ctx) => issueAccessToken(ctx, sessionToken));

    const sessionId = await t.run(async (ctx) => (await ctx.db.query("sessions").collect())[0]._id);
    await t.run((ctx) => deleteSessionAndAccessTokens(ctx, sessionId));

    expect(await t.run((ctx) => verifySession(ctx, sessionToken))).toBeNull();
    expect(await t.run((ctx) => verifyAccessToken(ctx, first.accessToken))).toBeNull();
    expect(await t.run((ctx) => verifyAccessToken(ctx, second.accessToken))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("accessTokens").collect())).toHaveLength(0);
  });
});

describe(`createSessionForUser: expulsión al superar ${MAX_SESSIONS_PER_USER} sesiones no deja accessTokens huérfanos`, () => {
  test(`un login ${MAX_SESSIONS_PER_USER + 1} borra la sesión más antigua Y todos sus accessTokens`, async () => {
    const t = convexTest(schema, modules);
    await makeActiveUser(t);

    const sessions: { token: string; accessToken: string }[] = [];
    for (let i = 0; i < MAX_SESSIONS_PER_USER; i++) {
      const { token } = await t.run((ctx) => login(ctx, { email: EMAIL, password: PASSWORD }));
      const { accessToken } = await t.run((ctx) => issueAccessToken(ctx, token));
      sessions.push({ token, accessToken });
    }

    // Este login expulsa la sesión más antigua (la primera del bucle).
    await t.run((ctx) => login(ctx, { email: EMAIL, password: PASSWORD }));

    expect(await t.run((ctx) => verifySession(ctx, sessions[0].token))).toBeNull();
    expect(await t.run((ctx) => verifyAccessToken(ctx, sessions[0].accessToken))).toBeNull();

    // Comprobación directa (no solo por verifyAccessToken devolviendo
    // null): ningún accessToken restante debe apuntar a una sesión que ya
    // no existe.
    const remainingTokens = await t.run((ctx) => ctx.db.query("accessTokens").collect());
    const remainingSessionIds = new Set((await t.run((ctx) => ctx.db.query("sessions").collect())).map((s) => s._id));
    expect(remainingTokens.length).toBeGreaterThan(0);
    for (const row of remainingTokens) {
      expect(remainingSessionIds.has(row.sessionId)).toBe(true);
    }
  });
});

describe("destroySession / destroySessionsForUser: cascada a accessTokens", () => {
  test("destroySession borra también los accessTokens de esa sesión", async () => {
    const t = convexTest(schema, modules);
    await makeActiveUser(t);
    const { token: sessionToken } = await t.run((ctx) => login(ctx, { email: EMAIL, password: PASSWORD }));
    const { accessToken } = await t.run((ctx) => issueAccessToken(ctx, sessionToken));

    await t.run((ctx) => destroySession(ctx, sessionToken));

    expect(await t.run((ctx) => ctx.db.query("accessTokens").collect())).toHaveLength(0);
    expect(await t.run((ctx) => verifyAccessToken(ctx, accessToken))).toBeNull();
  });

  test("destroySessionsForUser borra los accessTokens de todas las sesiones del usuario", async () => {
    const t = convexTest(schema, modules);
    await makeActiveUser(t);
    const userId = await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", EMAIL)).unique();
      return user!._id;
    });
    const first = await t.run((ctx) => login(ctx, { email: EMAIL, password: PASSWORD }));
    const second = await t.run((ctx) => login(ctx, { email: EMAIL, password: PASSWORD }));
    const firstAccess = await t.run((ctx) => issueAccessToken(ctx, first.token));
    const secondAccess = await t.run((ctx) => issueAccessToken(ctx, second.token));

    await t.run((ctx) => destroySessionsForUser(ctx, userId));

    expect(await t.run((ctx) => ctx.db.query("accessTokens").collect())).toHaveLength(0);
    expect(await t.run((ctx) => verifyAccessToken(ctx, firstAccess.accessToken))).toBeNull();
    expect(await t.run((ctx) => verifyAccessToken(ctx, secondAccess.accessToken))).toBeNull();
  });
});
