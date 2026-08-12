import { compareSync, truncates } from "bcryptjs";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { businessDayKey } from "../../lib/shared/businessDay";
import type { UserRole } from "./users";
import { EMAIL_MAX_LENGTH, MAX_PASSWORD_INPUT_LENGTH } from "./inputLimits";
import { fail } from "./errors";

export type LoginErrorCode = "INVALID_CREDENTIALS" | "ACCOUNT_INACTIVE";

export type LoginResult = {
  token: string;
  userId: Id<"users">;
  name: string;
  role: UserRole;
  mustChangePassword: boolean;
};

export type VerifiedUser = {
  userId: Id<"users">;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
};

const TOKEN_BYTE_LENGTH = 32;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

// Hash bcrypt fijo, no calculado en runtime (cost 10, formato válido) — no
// corresponde a ninguna contraseña real. Sirve solo para que compareSync se
// ejecute igual (mismo coste) cuando el email no existe, así el tiempo de
// respuesta no delata si una cuenta existe o no.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8k3fvzTQfJyLU6Zpz3AJfa9KOZ.rGm";

// Máximo de sesiones activas por usuario. Margen razonable de dispositivos
// para los dos usuarios reales de este CRM (móvil, portátil, algún
// repuesto). Se aplica dentro de createSessionForUser, no en cada caller.
export const MAX_SESSIONS_PER_USER = 5;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(TOKEN_BYTE_LENGTH)));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

/**
 * Único punto que borra una fila de `sessions` (PRO-59): borra primero
 * todos los `accessTokens` derivados de esa sesión, luego la sesión misma.
 * createSessionForUser/destroySession/destroySessionsForUser reusan esto en
 * vez de un `ctx.db.delete(session._id)` directo — si alguno lo hiciera por
 * su cuenta, los accessTokens de esa sesión quedarían huérfanos para
 * siempre (ninguna sesión desde la que issueAccessToken pudiera limpiarlos).
 */
export async function deleteSessionAndAccessTokens(ctx: MutationCtx, sessionId: Id<"sessions">): Promise<void> {
  const tokens = await ctx.db
    .query("accessTokens")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .collect();
  for (const token of tokens) {
    await ctx.db.delete(token._id);
  }
  await ctx.db.delete(sessionId);
}

/**
 * Único punto de creación de una fila de `sessions`: aplica el límite por
 * usuario antes de insertar, así ningún caller (login, changePassword,
 * futuro PRO-47) puede olvidarse de él. Si por cualquier motivo hubiera más
 * de MAX_SESSIONS_PER_USER filas ya existentes (createSessionForUser es el
 * único escritor, así que en condiciones normales nunca pasa), se borran
 * todas las que sobren, no solo una, para restaurar la invariante en vez de
 * dejarla degradarse.
 */
export async function createSessionForUser(ctx: MutationCtx, userId: Id<"users">): Promise<string> {
  const existing = await ctx.db
    .query("sessions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  if (existing.length >= MAX_SESSIONS_PER_USER) {
    const excess = existing.length - MAX_SESSIONS_PER_USER + 1;
    const oldestFirst = [...existing].sort((a, b) => a._creationTime - b._creationTime);
    for (const session of oldestFirst.slice(0, excess)) {
      await deleteSessionAndAccessTokens(ctx, session._id);
    }
  }
  const token = generateToken();
  const tokenHash = await sha256Hex(token);
  await ctx.db.insert("sessions", { userId, tokenHash, createdDate: businessDayKey(new Date()) });
  return token;
}

/**
 * Único punto de autenticación por email+contraseña. Orden deliberado:
 * compareSync se ejecuta SIEMPRE (contra el hash real o DUMMY_HASH si no
 * hay usuario), para que el tiempo de respuesta no delate si el email
 * existe. truncates() se comprueba aparte y se SUMA como motivo de rechazo:
 * un passwordHash real nunca corresponde a una contraseña de más de 72
 * bytes (createUser ya la habría rechazado), así que si la candidata los
 * supera, un "match" de compareSync sería la semántica de truncado de
 * bcrypt, no una coincidencia real — se rechaza explícitamente. Solo si
 * todo eso pasa se mira el estado de la cuenta, nunca antes (para no
 * revelar que una cuenta desactivada existe a quien no conoce su
 * contraseña).
 */
export async function login(ctx: MutationCtx, args: { email: string; password: string }): Promise<LoginResult> {
  if (args.email.length > EMAIL_MAX_LENGTH || args.password.length > MAX_PASSWORD_INPUT_LENGTH) {
    fail<LoginErrorCode>("INVALID_CREDENTIALS", "Email o contraseña incorrectos.");
  }
  const email = args.email.trim().toLowerCase();
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  const passwordMatches = compareSync(args.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordMatches || truncates(args.password)) {
    fail<LoginErrorCode>("INVALID_CREDENTIALS", "Email o contraseña incorrectos.");
  }
  if (user.status === "inactive") {
    fail<LoginErrorCode>("ACCOUNT_INACTIVE", "Esta cuenta ya no tiene acceso.");
  }
  const token = await createSessionForUser(ctx, user._id);
  return { token, userId: user._id, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword };
}

type ActiveSession = { session: Doc<"sessions">; user: Doc<"users"> };

/**
 * Único punto de búsqueda de una sesión activa a partir de un token de
 * sesión largo: formato, existencia y cuenta no desactivada. Deliberadamente
 * NO mira `mustChangePassword` — `verifySession` sigue necesitando reconocer
 * una sesión así de "activa" para poder redirigir al formulario de cambio de
 * contraseña (ese flag se comprueba aparte, en cada caller que lo necesite:
 * `issueAccessToken` aquí mismo, `app/(app)/layout.tsx` para la navegación).
 * Devuelve también la fila de `sessions` (no solo el usuario) porque
 * `issueAccessToken` necesita su `_id` para enlazar el `accessToken` nuevo.
 */
async function findActiveSession(ctx: QueryCtx | MutationCtx, token: string): Promise<ActiveSession | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const tokenHash = await sha256Hex(token);
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!session) return null;
  const user = await ctx.db.get(session.userId);
  if (!user || user.status === "inactive") return null;
  return { session, user };
}

/**
 * Único punto de verificación de un token de sesión. Revocación en
 * caliente: si el usuario ha pasado a "inactive" después de crear la
 * sesión, deja de verificar sin necesidad de borrar la fila.
 */
export async function verifySession(ctx: QueryCtx | MutationCtx, token: string): Promise<VerifiedUser | null> {
  const active = await findActiveSession(ctx, token);
  if (!active) return null;
  const { user } = active;
  return { userId: user._id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword };
}

/** Cierra una sesión concreta. Idempotente: un token desconocido no lanza. */
export async function destroySession(ctx: MutationCtx, token: string): Promise<void> {
  if (!TOKEN_PATTERN.test(token)) return;
  const tokenHash = await sha256Hex(token);
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (session) await deleteSessionAndAccessTokens(ctx, session._id);
}

/**
 * Cierra TODAS las sesiones de un usuario, incluida la que se esté usando
 * para llamarla — changePassword la usa así a propósito, para rotar la
 * sesión al cambiar la contraseña (ver convex/model/users.ts). Lista para
 * que una futura baja de empleado (PRO-47) la reuse igual al desactivar una
 * cuenta; no se añade esa llamada en esta tarea.
 */
export async function destroySessionsForUser(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const session of sessions) {
    await deleteSessionAndAccessTokens(ctx, session._id);
  }
}

export type IssueAccessTokenErrorCode = "SESSION_INVALID" | "PASSWORD_CHANGE_REQUIRED";

export type IssueAccessTokenResult = { accessToken: string; expiresAt: number; serverNow: number };

// 20 min: suficientemente corto para que un token filtrado (p. ej. en un log
// de red) tenga una ventana de uso limitada, suficientemente largo para no
// forzar refrescos constantes durante una sesión de trabajo normal.
export const ACCESS_TOKEN_TTL_MS = 20 * 60 * 1000;
// Margen para varias pestañas/dispositivos emitiendo tokens de forma
// independiente sin invalidarse entre sí (ver accessTokens como tabla
// aparte, no un campo único en `sessions`). Al llegar a este límite, emitir
// uno más desaloja el activo más antiguo — no es un error, es la política de
// desalojo documentada aquí y en README.md.
export const MAX_ACCESS_TOKENS_PER_SESSION = 8;

/**
 * Emite un accessToken de corta duración a partir de un token de sesión ya
 * validado. Única mutation del par — toda la limpieza física de
 * `accessTokens` (expirados + desalojo por límite) vive aquí, nunca en
 * verifyAccessToken (que es de solo lectura, ver más abajo).
 */
export async function issueAccessToken(ctx: MutationCtx, sessionToken: string): Promise<IssueAccessTokenResult> {
  const active = await findActiveSession(ctx, sessionToken);
  if (!active) {
    fail<IssueAccessTokenErrorCode>("SESSION_INVALID", "Tu sesión ha caducado. Vuelve a iniciar sesión.");
  }
  const { session, user } = active;
  // A diferencia de findActiveSession (que deliberadamente no lo mira, ver
  // su docstring), aquí sí bloquea: una cuenta con el cambio de contraseña
  // pendiente no puede obtener credenciales para llamar a clients.*/notes.*/
  // followUps.*/sales.* directamente — cerraría exactamente el mismo hueco
  // que PRO-59 existe para tapar.
  if (user.mustChangePassword) {
    fail<IssueAccessTokenErrorCode>("PASSWORD_CHANGE_REQUIRED", "Debes cambiar tu contraseña antes de continuar.");
  }

  const now = Date.now();
  const existing = await ctx.db
    .query("accessTokens")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
    .collect();
  const stillActive: Doc<"accessTokens">[] = [];
  for (const row of existing) {
    if (row.expiresAt <= now) {
      await ctx.db.delete(row._id);
    } else {
      stillActive.push(row);
    }
  }
  if (stillActive.length >= MAX_ACCESS_TOKENS_PER_SESSION) {
    const excess = stillActive.length - MAX_ACCESS_TOKENS_PER_SESSION + 1;
    const oldestFirst = [...stillActive].sort((a, b) => a._creationTime - b._creationTime);
    for (const row of oldestFirst.slice(0, excess)) {
      await ctx.db.delete(row._id);
    }
  }

  const accessToken = generateToken();
  const tokenHash = await sha256Hex(accessToken);
  // `now` se reutiliza para expiresAt y serverNow — deben ser el mismo
  // instante exacto, no dos lecturas de reloj separadas: el provider cliente
  // (ConvexAccessTokenProvider) usa serverNow para corregir su propio reloj
  // contra el de Convex, y esa corrección solo es válida si expiresAt se
  // calculó desde ese mismo instante.
  const expiresAt = now + ACCESS_TOKEN_TTL_MS;
  const accessTokenId = await ctx.db.insert("accessTokens", { sessionId: session._id, tokenHash, expiresAt });
  // Ronda 6 de auditoría: Convex solo reevalúa una query en vivo cuando
  // cambia un documento que leyó, nunca porque el reloj de pared avance por
  // sí solo — verifyAccessToken comparando expiresAt contra Date.now() (más
  // abajo) no basta para invalidar una suscripción que ya lo leyó una vez.
  // Programar aquí el borrado físico de esta fila crea esa escritura real en
  // el instante de caducidad, forzando la reevaluación; el chequeo temporal
  // de verifyAccessToken se conserva como defensa adicional (p. ej. mientras
  // el scheduler no ha llegado a ejecutar esta función todavía).
  await ctx.scheduler.runAfter(ACCESS_TOKEN_TTL_MS, internal.sessions.expireAccessToken, { accessTokenId });
  return { accessToken, expiresAt, serverNow: now };
}

/**
 * Ejecutada por el scheduler de Convex (ver issueAccessToken) exactamente
 * ACCESS_TOKEN_TTL_MS después de emitir el token. Idempotente ante una fila
 * que ya no existe: la sesión pudo borrarse entera (deleteSessionAndAccessTokens)
 * o este accessToken concreto pudo ser desalojado antes por el límite de
 * MAX_ACCESS_TOKENS_PER_SESSION — en ambos casos no hay nada que borrar.
 */
export async function expireAccessTokenIfDue(ctx: MutationCtx, accessTokenId: Id<"accessTokens">): Promise<void> {
  const row = await ctx.db.get(accessTokenId);
  if (row) await ctx.db.delete(accessTokenId);
}

/**
 * Verifica un accessToken de corta duración. De solo lectura a propósito
 * (nunca `ctx.db.delete`): esta función también se llama desde queries
 * (`QueryCtx`, sin acceso de escritura) en las 14 funciones públicas de
 * negocio. Un token expirado simplemente deja de verificar; su limpieza
 * física ocurre en la próxima `issueAccessToken` de esa sesión, al borrarse
 * la sesión entera vía `deleteSessionAndAccessTokens`, o vía el borrado
 * programado de expireAccessTokenIfDue — este chequeo temporal es una
 * defensa adicional, no el mecanismo principal de invalidación reactiva.
 */
export async function verifyAccessToken(ctx: QueryCtx | MutationCtx, accessToken: string): Promise<VerifiedUser | null> {
  if (!TOKEN_PATTERN.test(accessToken)) return null;
  const tokenHash = await sha256Hex(accessToken);
  const row = await ctx.db
    .query("accessTokens")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!row) return null;
  if (row.expiresAt <= Date.now()) return null;
  const session = await ctx.db.get(row.sessionId);
  if (!session) return null;
  const user = await ctx.db.get(session.userId);
  if (!user || user.status !== "active" || user.mustChangePassword) return null;
  return { userId: user._id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword };
}
