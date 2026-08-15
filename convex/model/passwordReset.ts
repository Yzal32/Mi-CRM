import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { toHex } from "./tokens";

const CODE_LENGTH = 6;
const CODE_DIGITS = "0123456789";
const CODE_PATTERN = /^\d{6}$/;

// 15 min: ventana corta a propósito — un código pensado para teclearse en
// el momento no necesita la misma ventana que un enlace (PRO-67 usaba 1h).
export const PASSWORD_RESET_CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
// Sin este margen, el límite de intentos no protege nada: bastaría con
// pedir un código nuevo cada vez que se agoten los 5 intentos para tener
// intentos ilimitados en total (ver verifyPasswordResetCode más abajo).
export const MIN_REQUEST_INTERVAL_MS = 60 * 1000;

// Mismo patrón de descarte por sesgo que generateTemporaryPassword
// (convex/model/users.ts) — 256 no es múltiplo de 10, así que un byte crudo
// mod 10 sesgaría hacia los dígitos 0-5. Se descartan los bytes >= 250.
function generateCode(): string {
  const maxUnbiased = Math.floor(256 / CODE_DIGITS.length) * CODE_DIGITS.length;
  let result = "";
  while (result.length < CODE_LENGTH) {
    const [byte] = crypto.getRandomValues(new Uint8Array(1));
    if (byte >= maxUnbiased) continue;
    result += CODE_DIGITS[byte % CODE_DIGITS.length];
  }
  return result;
}

/**
 * HMAC-SHA256 con un secreto propio del servidor (pepper), no un hash
 * simple: con solo 1.000.000 de códigos posibles, SHA-256(código) a secas
 * se invierte offline en milisegundos con solo leer la tabla
 * `passwordResets` (probar los 1.000.000 de códigos y comparar); el HMAC lo
 * hace inviable sin conocer también el pepper, que nunca se guarda en la
 * base de datos (solo vive como variable de entorno de Convex).
 */
async function hmacCodeHash(pepper: string, code: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(code));
  return toHex(new Uint8Array(signature));
}

/**
 * Como mucho un código activo por usuario. Si ya hay uno emitido hace menos
 * de MIN_REQUEST_INTERVAL_MS, no genera ni envía uno nuevo (devuelve null)
 * — uno de los controles anti-fuerza-bruta (ver verifyPasswordResetCode).
 * Si el existente es más antiguo que el margen, lo sustituye.
 */
export async function createPasswordReset(ctx: MutationCtx, args: { userId: Id<"users">; pepper: string }): Promise<string | null> {
  const existing = await ctx.db
    .query("passwordResets")
    .withIndex("by_userId", (q) => q.eq("userId", args.userId))
    .unique();
  if (existing) {
    if (Date.now() - existing.createdAt < MIN_REQUEST_INTERVAL_MS) return null;
    await ctx.db.delete(existing._id);
  }
  const code = generateCode();
  const codeHash = await hmacCodeHash(args.pepper, code);
  const now = Date.now();
  await ctx.db.insert("passwordResets", {
    userId: args.userId,
    codeHash,
    createdAt: now,
    expiresAt: now + PASSWORD_RESET_CODE_TTL_MS,
    attempts: 0,
  });
  return code;
}

/**
 * Verifica el código contra la única fila del usuario. Devuelve un booleano
 * en vez de lanzar (a diferencia del resto del proyecto, que usa
 * `fail<ErrorCode>`) porque Convex revierte TODOS los writes de una
 * mutation si esta lanza — si esta función incrementara `attempts` y luego
 * lanzara, ese incremento nunca llegaría a persistir. El caller
 * (verifyResetCode, convex/passwordReset.ts) es su propia `internalMutation`
 * independiente: al devolver normalmente (sin lanzar), su commit —
 * incluido el incremento de `attempts` en caso de fallo — queda garantizado
 * exista o no éxito final en la action que la orquesta.
 *
 * Al agotar MAX_CODE_ATTEMPTS la fila NO se borra: se sigue rechazando
 * cualquier código, incluso el correcto, mientras
 * `attempts >= MAX_CODE_ATTEMPTS`. Borrarla perdería `createdAt` junto con
 * ella, y createPasswordReset dejaría de tener nada contra qué medir
 * MIN_REQUEST_INTERVAL_MS — permitiría pedir un código nuevo al instante
 * tras agotar los 5 intentos y reiniciar el contador sin esperar, anulando
 * el control. Conservar la fila agotada hace que el margen de un minuto se
 * siga aplicando: solo tras esperarlo, createPasswordReset la sustituye por
 * una nueva con `attempts: 0`.
 */
export async function verifyPasswordResetCode(ctx: MutationCtx, args: { userId: Id<"users">; code: string; pepper: string }): Promise<boolean> {
  if (!CODE_PATTERN.test(args.code)) return false;
  const reset = await ctx.db
    .query("passwordResets")
    .withIndex("by_userId", (q) => q.eq("userId", args.userId))
    .unique();
  if (!reset || reset.expiresAt <= Date.now() || reset.attempts >= MAX_CODE_ATTEMPTS) return false;
  const codeHash = await hmacCodeHash(args.pepper, args.code);
  if (codeHash !== reset.codeHash) {
    await ctx.db.patch(reset._id, { attempts: reset.attempts + 1 });
    return false;
  }
  return true;
}

/**
 * Borra todas las filas de `passwordResets` de un usuario — se llama tras
 * un restablecimiento correcto.
 */
export async function deletePasswordResetsForUser(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const resets = await ctx.db
    .query("passwordResets")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const reset of resets) {
    await ctx.db.delete(reset._id);
  }
}
