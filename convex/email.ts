import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { fail } from "./model/errors";
import { sendEmail, type SendEmailErrorCode } from "./model/email";

// Modo sandbox (PRO-66): sin dominio propio verificado, Resend solo entrega
// a la dirección con la que está registrada la cuenta. Cambiar este
// remitente cuando exista un dominio propio verificado en Resend.
const SANDBOX_FROM_ADDRESS = "Mi CRM <onboarding@resend.dev>";

/**
 * Solo para verificar manualmente que el envío con Resend funciona.
 * No se llama desde ninguna UI. Invocar por CLI:
 *   npx convex run email:sendTestEmail '{"to":"tu-email@ejemplo.com"}'
 * (debe ser la dirección con la que está registrada la cuenta de Resend).
 */
export const sendTestEmail = internalAction({
  args: { to: v.string() },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      fail<SendEmailErrorCode>("SEND_EMAIL_FAILED", "Resend no está configurado (falta RESEND_API_KEY).");
    }
    await sendEmail({
      apiKey,
      from: SANDBOX_FROM_ADDRESS,
      to: args.to,
      subject: "Prueba de Resend — Mi CRM",
      html: "<p>Si ves este email, el envío de prueba con Resend funciona.</p>",
    });
    return null;
  },
});

/**
 * Envía el email de "olvidé mi contraseña" (PRO-68, código en vez de
 * enlace desde PRO-67) — invocada solo desde
 * passwordReset.requestPasswordReset (internalAction, no alcanzable desde
 * ninguna UI ni cliente directamente). Mismo remitente sandbox que
 * sendTestEmail mientras no exista un dominio propio verificado.
 */
export const sendPasswordResetEmail = internalAction({
  args: { to: v.string(), code: v.string() },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      fail<SendEmailErrorCode>("SEND_EMAIL_FAILED", "Resend no está configurado (falta RESEND_API_KEY).");
    }
    await sendEmail({
      apiKey,
      from: SANDBOX_FROM_ADDRESS,
      to: args.to,
      subject: "Tu código para restablecer la contraseña — Mi CRM",
      html:
        "<p>Usa este código para restablecer tu contraseña:</p>" +
        `<p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${args.code}</p>` +
        "<p>Caduca en 15 minutos. Si no has sido tú, puedes ignorar este correo.</p>",
    });
    return null;
  },
});
