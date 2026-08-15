import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { fail } from "./model/errors";
import { resetPasswordAfterVerification } from "./model/users";
import { createPasswordReset, verifyPasswordResetCode, deletePasswordResetsForUser } from "./model/passwordReset";

export type PasswordResetConfigErrorCode = "PASSWORD_RESET_NOT_CONFIGURED";
export type ResetPasswordErrorCode = "RESET_CODE_INVALID";

/**
 * Punto de entrada de "olvidé mi contraseña" (PRO-68). Respuesta siempre
 * idéntica (null) exista o no una cuenta con ese email — createResetForEmail
 * decide en silencio si hay algo que enviar, mismo criterio de no revelar
 * cuentas que sessions.login.
 */
export const requestPasswordReset = action({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(internal.passwordReset.createResetForEmail, { email: args.email });
    if (result) {
      await ctx.runAction(internal.email.sendPasswordResetEmail, { to: result.email, code: result.code });
    }
    return null;
  },
});

export const createResetForEmail = internalMutation({
  args: { email: v.string() },
  returns: v.union(v.object({ code: v.string(), email: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const pepper = process.env.PASSWORD_RESET_CODE_PEPPER;
    if (!pepper) {
      fail<PasswordResetConfigErrorCode>("PASSWORD_RESET_NOT_CONFIGURED", "La recuperación de contraseña no está configurada.");
    }
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    // Silencioso: mismo trato para "no existe" e "inactivo" — no revela cuál es cuál.
    if (!user || user.status === "inactive") return null;
    const code = await createPasswordReset(ctx, { userId: user._id, pepper }); // null si hay cooldown activo
    if (!code) return null;
    return { code, email: user.email };
  },
});

/**
 * Resuelve el email a un usuario y verifica el código, en una única
 * mutation que se comita de forma independiente aunque la action que la
 * llama (resetPassword) termine fallando después — necesario para que el
 * incremento de `attempts` en un intento fallido sobreviva (ver
 * convex/model/passwordReset.ts, verifyPasswordResetCode). Devuelve el
 * userId solo si el código es correcto; null en cualquier otro caso
 * (email inexistente, código incorrecto, caducado o agotado) — mismo
 * código de error genérico para todos desde la action, no revela cuál fue.
 */
export const verifyResetCode = internalMutation({
  args: { email: v.string(), code: v.string(), pepper: v.string() },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) return null;
    const ok = await verifyPasswordResetCode(ctx, { userId: user._id, code: args.code, pepper: args.pepper });
    return ok ? user._id : null;
  },
});

/** Aplica la contraseña nueva y limpia los códigos de recuperación del usuario, tras un código ya verificado. */
export const applyNewPassword = internalMutation({
  args: { userId: v.id("users"), newPassword: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await resetPasswordAfterVerification(ctx, { userId: args.userId, newPassword: args.newPassword });
    await deletePasswordResetsForUser(ctx, args.userId);
    return null;
  },
});

/**
 * Público (PRO-68). Es una `action`, no una `mutation`, precisamente para
 * poder orquestar verifyResetCode + applyNewPassword como dos mutations
 * independientes: si applyNewPassword nunca llega a ejecutarse (código
 * incorrecto), el incremento de `attempts` de verifyResetCode ya se comitó
 * de todas formas.
 */
export const resetPassword = action({
  args: { email: v.string(), code: v.string(), newPassword: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const pepper = process.env.PASSWORD_RESET_CODE_PEPPER;
    if (!pepper) {
      fail<PasswordResetConfigErrorCode>("PASSWORD_RESET_NOT_CONFIGURED", "La recuperación de contraseña no está configurada.");
    }
    const userId = await ctx.runMutation(internal.passwordReset.verifyResetCode, { email: args.email, code: args.code, pepper });
    if (!userId) {
      fail<ResetPasswordErrorCode>("RESET_CODE_INVALID", "Código incorrecto o caducado.");
    }
    await ctx.runMutation(internal.passwordReset.applyNewPassword, { userId, newPassword: args.newPassword });
    return null;
  },
});
