"use server";

import { redirect } from "next/navigation";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { getConvexServerClient } from "@/lib/convexServer";
import { setSessionCookie } from "@/lib/auth/session";

export type LoginActionErrorCode = "INVALID_CREDENTIALS" | "ACCOUNT_INACTIVE" | "UNKNOWN";

function convexErrorCode(error: unknown): string | undefined {
  if (
    error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null &&
    typeof (error.data as Record<string, unknown>).code === "string"
  ) {
    return (error.data as Record<string, unknown>).code as string;
  }
  return undefined;
}

/**
 * Invocada como función directa desde components/auth/LoginScreen.tsx (no
 * vía <form action>): es una Server Action, la única forma de fijar la
 * cookie httpOnly de sesión en la misma respuesta — una mutation de Convex
 * llamada desde el navegador (useMutation) nunca podría hacerlo.
 */
export async function loginAction(args: { email: string; password: string }): Promise<{ error: LoginActionErrorCode } | undefined> {
  let result;
  try {
    result = await getConvexServerClient().mutation(api.sessions.login, args);
  } catch (error) {
    const code = convexErrorCode(error);
    if (code === "INVALID_CREDENTIALS" || code === "ACCOUNT_INACTIVE") {
      return { error: code };
    }
    // Nunca se propaga el mensaje crudo del error original.
    return { error: "UNKNOWN" };
  }
  await setSessionCookie(result.token);
  redirect(result.mustChangePassword ? "/cambiar-contrasena" : "/");
}
