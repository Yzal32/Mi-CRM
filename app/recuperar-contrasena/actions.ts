"use server";

import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { getConvexServerClient } from "@/lib/convexServer";

/**
 * Nunca distingue si el email existe o no, ni si Convex falló por otro
 * motivo (pepper sin configurar, red, etc.): siempre el mismo redirect,
 * mismo criterio de no revelar cuentas que el resto del flujo de
 * recuperación (ver convex/passwordReset.ts, requestPasswordReset). El
 * email viaja en la URL de destino como comodidad (no es secreto, a
 * diferencia del código) para prellenar el siguiente formulario.
 */
export async function requestPasswordResetAction(args: { email: string }): Promise<void> {
  try {
    await getConvexServerClient().action(api.passwordReset.requestPasswordReset, args);
  } catch {
    // Ignorado a propósito.
  }
  redirect(`/restablecer-contrasena?email=${encodeURIComponent(args.email)}`);
}
