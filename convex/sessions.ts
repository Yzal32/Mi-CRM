import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  login as loginModel,
  verifySession as verifySessionModel,
  destroySession as destroySessionModel,
  issueAccessToken as issueAccessTokenModel,
  expireAccessTokenIfDue,
  loginWithGoogleEmail as loginWithGoogleEmailModel,
} from "./model/sessions";
import { exchangeGoogleCodeForEmail } from "./model/googleOAuth";
import { fail } from "./model/errors";

const roleValidator = v.union(v.literal("owner"), v.literal("employee"));

/**
 * Mutations/queries públicas a propósito: un login no puede exigir estar ya
 * autenticado. Ninguno de los DTOs de retorno incluye `passwordHash`.
 */
export const login = mutation({
  args: { email: v.string(), password: v.string() },
  returns: v.object({
    token: v.string(),
    name: v.string(),
    role: roleValidator,
    mustChangePassword: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const result = await loginModel(ctx, args);
    return { token: result.token, name: result.name, role: result.role, mustChangePassword: result.mustChangePassword };
  },
});

export const verify = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      name: v.string(),
      email: v.string(),
      role: roleValidator,
      mustChangePassword: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => verifySessionModel(ctx, args.token),
});

export const logout = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await destroySessionModel(ctx, args.token);
    return null;
  },
});

// PRO-59: emite un accessToken de corta duración a partir del token de
// sesión largo (cookie httpOnly, nunca visto por JS de cliente). Llamada
// exclusivamente desde app/api/auth/convex-token/route.ts, nunca
// directamente desde un componente — ver ConvexAccessTokenProvider.tsx.
export const issueAccessToken = mutation({
  args: { token: v.string() },
  returns: v.object({
    accessToken: v.string(),
    expiresAt: v.number(),
    serverNow: v.number(),
  }),
  handler: async (ctx, args) => issueAccessTokenModel(ctx, args.token),
});

/**
 * internalMutation a propósito (PRO-63): solo alcanzable vía
 * `ctx.runMutation` desde dentro de Convex (la action `loginWithGoogle` de
 * abajo), nunca desde un cliente HTTP externo — si fuera pública, cualquiera
 * podría llamarla con un email inventado y saltarse por completo el
 * consentimiento real de Google.
 */
export const loginWithGoogleEmail = internalMutation({
  args: { email: v.string() },
  returns: v.object({ token: v.string(), mustChangePassword: v.boolean() }),
  handler: async (ctx, args) => {
    const result = await loginWithGoogleEmailModel(ctx, args.email);
    return { token: result.token, mustChangePassword: result.mustChangePassword };
  },
});

/**
 * Login con Google (PRO-63) — primera `action` del proyecto: solo una
 * `action` puede hacer `fetch` saliente (aquí, hacia Google). Pública a
 * propósito: la "prueba de identidad" no es el email en sí (cualquiera
 * podría inventarlo como argumento), sino el `code` de un solo uso que
 * Google emite tras el consentimiento real, y que solo esta action puede
 * canjear (posee GOOGLE_CLIENT_SECRET, variable de entorno de Convex, nunca
 * de Next.js/Railway) — un `code` inventado simplemente falla el
 * intercambio con Google, sin crear sesión.
 */
export const loginWithGoogle = action({
  args: { code: v.string(), redirectUri: v.string() },
  returns: v.object({ token: v.string(), mustChangePassword: v.boolean() }),
  handler: async (ctx, args): Promise<{ token: string; mustChangePassword: boolean }> => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      fail<"GOOGLE_LOGIN_FAILED">("GOOGLE_LOGIN_FAILED", "Inicio de sesión con Google no configurado.");
    }
    const email = await exchangeGoogleCodeForEmail({ code: args.code, redirectUri: args.redirectUri, clientId, clientSecret });
    return ctx.runMutation(internal.sessions.loginWithGoogleEmail, { email });
  },
});

// PRO-59 (ronda 6 de auditoría): borra físicamente un accessToken al cumplirse
// su TTL. Programada por issueAccessToken (convex/model/sessions.ts) vía
// ctx.scheduler.runAfter — nunca llamada directamente por un cliente. Esta
// escritura es lo que fuerza a Convex a reevaluar cualquier query en vivo que
// ya había leído esa fila; el paso del tiempo por sí solo no lo hace.
export const expireAccessToken = internalMutation({
  args: { accessTokenId: v.id("accessTokens") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await expireAccessTokenIfDue(ctx, args.accessTokenId);
    return null;
  },
});
