import { compareSync, truncates } from "bcryptjs";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
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
      await ctx.db.delete(session._id);
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

/**
 * Único punto de verificación de un token de sesión. Revocación en
 * caliente: si el usuario ha pasado a "inactive" después de crear la
 * sesión, deja de verificar sin necesidad de borrar la fila.
 */
export async function verifySession(ctx: QueryCtx | MutationCtx, token: string): Promise<VerifiedUser | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const tokenHash = await sha256Hex(token);
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!session) return null;
  const user = await ctx.db.get(session.userId);
  if (!user || user.status === "inactive") return null;
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
  if (session) await ctx.db.delete(session._id);
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
    await ctx.db.delete(session._id);
  }
}
