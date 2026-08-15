import { v } from "convex/values";
import { action, internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { fail } from "./model/errors";
import { resetPasswordWithToken } from "./model/users";
import { createPasswordReset, resolvePasswordResetToken, deletePasswordResetsForUser } from "./model/passwordReset";

export type RequestPasswordResetErrorCode = "APP_URL_NOT_CONFIGURED";

// No basta con que APP_URL exista, tiene que ser una URL absoluta http(s)
// real — una env var mal escrita (p. ej. sin esquema) generaría enlaces
// rotos en el email sin que nada lo avisara hasta que un usuario se quejara.
function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Punto de entrada de "olvidé mi contraseña" (PRO-67). Respuesta siempre
 * idéntica (null) exista o no una cuenta con ese email — createResetForEmail
 * decide en silencio si hay algo que enviar, mismo criterio de no revelar
 * cuentas que sessions.login.
 *
 * `appUrl` NUNCA es un argumento de esta action pública: es una `action`
 * alcanzable directamente por cualquier cliente Convex (sin pasar por el
 * Server Action de Next.js), así que un argumento así sería controlable por
 * un atacante, que podría hacer que el email de recuperación de una
 * víctima enlazara a un dominio propio y robar el token. La URL base sale
 * de `process.env.APP_URL`, variable de entorno de Convex (fuente de
 * confianza del propio servidor) — si falta o es inválida, la action falla
 * en cerrado antes de mirar el email, para que el fallo tampoco sirva de
 * oráculo de qué cuentas existen.
 */
export const requestPasswordReset = action({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUrl = process.env.APP_URL;
    if (!appUrl || !isAbsoluteHttpUrl(appUrl)) {
      fail<RequestPasswordResetErrorCode>("APP_URL_NOT_CONFIGURED", "APP_URL no está configurada correctamente en Convex.");
    }
    const result = await ctx.runMutation(internal.passwordReset.createResetForEmail, { email: args.email });
    if (result) {
      const resetUrl = `${appUrl}/restablecer-contrasena/${result.token}`;
      await ctx.runAction(internal.email.sendPasswordResetEmail, { to: result.email, resetUrl });
    }
    return null;
  },
});

export const createResetForEmail = internalMutation({
  args: { email: v.string() },
  returns: v.union(v.object({ token: v.string(), email: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    // Silencioso: mismo trato para "no existe" e "inactivo" — no revela cuál es cuál.
    if (!user || user.status === "inactive") return null;
    const token = await createPasswordReset(ctx, user._id);
    return { token, email: user.email };
  },
});

export const resetPassword = mutation({
  args: { token: v.string(), newPassword: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await resolvePasswordResetToken(ctx, args.token);
    await resetPasswordWithToken(ctx, { userId, newPassword: args.newPassword });
    await deletePasswordResetsForUser(ctx, userId);
    return null;
  },
});
