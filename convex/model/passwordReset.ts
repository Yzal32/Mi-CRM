import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { generateToken, sha256Hex, TOKEN_PATTERN } from "./tokens";
import { fail } from "./errors";

export type PasswordResetErrorCode = "RESET_TOKEN_INVALID";

// 1 hora: ventana suficiente para completar el flujo desde el correo sin
// dejar el enlace utilizable indefinidamente si el email queda expuesto.
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Único punto de creación de una fila de `passwordResets`. Mismo patrón de
 * token opaco que las sesiones (ver convex/model/tokens.ts): el valor en
 * claro se devuelve una sola vez al caller (para incluirlo en el email),
 * solo el hash se persiste.
 */
export async function createPasswordReset(ctx: MutationCtx, userId: Id<"users">): Promise<string> {
  const token = generateToken();
  const tokenHash = await sha256Hex(token);
  await ctx.db.insert("passwordResets", { userId, tokenHash, expiresAt: Date.now() + PASSWORD_RESET_TOKEN_TTL_MS });
  return token;
}

/**
 * Resuelve un token de restablecimiento a su usuario, sin consumirlo
 * todavía — el caller decide cuándo gastarlo (solo tras validar la
 * contraseña nueva, para no quemarlo si esa validación falla). Un único
 * código de error genérico para "no existe" y "caducado": no hace falta
 * distinguirlos de cara al usuario.
 */
export async function resolvePasswordResetToken(ctx: MutationCtx, token: string): Promise<Id<"users">> {
  if (!TOKEN_PATTERN.test(token)) {
    fail<PasswordResetErrorCode>("RESET_TOKEN_INVALID", "Este enlace no es válido o ha caducado.");
  }
  const tokenHash = await sha256Hex(token);
  const reset = await ctx.db
    .query("passwordResets")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!reset || reset.expiresAt <= Date.now()) {
    fail<PasswordResetErrorCode>("RESET_TOKEN_INVALID", "Este enlace no es válido o ha caducado.");
  }
  return reset.userId;
}

/**
 * Borra todas las filas de `passwordResets` de un usuario — se llama tras
 * un restablecimiento correcto, para que ningún otro enlace emitido
 * anteriormente (p. ej. varias solicitudes seguidas) siga siendo válido.
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
