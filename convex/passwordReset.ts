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
 * Verifica el código Y aplica la contraseña nueva en una única mutation —
 * corrección de una ronda de auditoría (B3): tenerlas en dos mutations
 * separadas (una que verifica y devuelve un userId "autorizado", otra que
 * lo consume) rompía el "un solo uso" bajo concurrencia — dos peticiones
 * con el mismo código correcto podían pasar ambas la verificación antes de
 * que ninguna llegara a consumirlo, y las dos acababan cambiando la
 * contraseña. Nunca lanza en el camino de "código incorrecto" (devuelve
 * "invalid" con normalidad) para que el incremento de `attempts` hecho por
 * verifyPasswordResetCode se comite igualmente — Convex revierte todos los
 * writes de una mutation que lanza, así que lanzar aquí perdería ese
 * incremento (el mismo problema que forzó separar esto en dos mutations en
 * un intento anterior, ver historial). Sí puede lanzar por una contraseña
 * nueva inválida (PASSWORD_TOO_SHORT, etc.): en ese caso no hay nada que
 * conservar — la verificación del código no escribió nada, así que el
 * código sigue disponible para reintentar con una contraseña válida.
 */
export const verifyAndApplyReset = internalMutation({
  args: { email: v.string(), code: v.string(), newPassword: v.string(), pepper: v.string() },
  returns: v.union(v.literal("ok"), v.literal("invalid")),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) return "invalid";
    const ok = await verifyPasswordResetCode(ctx, { userId: user._id, code: args.code, pepper: args.pepper });
    if (!ok) return "invalid";
    await resetPasswordAfterVerification(ctx, { userId: user._id, newPassword: args.newPassword });
    await deletePasswordResetsForUser(ctx, user._id);
    return "ok";
  },
});

/** Público (PRO-68). Envuelve verifyAndApplyReset (una sola mutation) y traduce "invalid" a un error tipado. */
export const resetPassword = action({
  args: { email: v.string(), code: v.string(), newPassword: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const pepper = process.env.PASSWORD_RESET_CODE_PEPPER;
    if (!pepper) {
      fail<PasswordResetConfigErrorCode>("PASSWORD_RESET_NOT_CONFIGURED", "La recuperación de contraseña no está configurada.");
    }
    const result = await ctx.runMutation(internal.passwordReset.verifyAndApplyReset, {
      email: args.email,
      code: args.code,
      newPassword: args.newPassword,
      pepper,
    });
    if (result === "invalid") {
      fail<ResetPasswordErrorCode>("RESET_CODE_INVALID", "Código incorrecto o caducado.");
    }
    return null;
  },
});
