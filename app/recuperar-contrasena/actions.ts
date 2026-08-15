"use server";

import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { getConvexServerClient } from "@/lib/convexServer";

/**
 * Nunca distingue si el email existe o no, ni si Convex falló por otro
 * motivo (config de APP_URL, red, etc.): siempre el mismo redirect, mismo
 * criterio de no revelar cuentas que el resto del flujo de recuperación
 * (ver convex/passwordReset.ts, requestPasswordReset).
 */
export async function requestPasswordResetAction(args: { email: string }): Promise<void> {
  try {
    await getConvexServerClient().action(api.passwordReset.requestPasswordReset, args);
  } catch {
    // Ignorado a propósito.
  }
  redirect("/recuperar-contrasena?enviado=1");
}
