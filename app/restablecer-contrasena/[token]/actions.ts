"use server";

import { redirect } from "next/navigation";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { getConvexServerClient } from "@/lib/convexServer";

export type ResetPasswordActionErrorCode = "RESET_TOKEN_INVALID" | "PASSWORD_REQUIRED" | "PASSWORD_TOO_SHORT" | "PASSWORD_TOO_LONG" | "UNKNOWN";

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
 * Sin cookie que fijar (a diferencia de loginAction/changePasswordAction):
 * un restablecimiento por enlace de email no auto-inicia sesión, ver
 * convex/model/users.ts (resetPasswordWithToken) — tras un cambio correcto,
 * el usuario entra por /login con la contraseña nueva.
 */
export async function resetPasswordAction(
  args: { token: string; newPassword: string },
): Promise<{ error: ResetPasswordActionErrorCode } | undefined> {
  try {
    await getConvexServerClient().mutation(api.passwordReset.resetPassword, args);
  } catch (error) {
    const code = convexErrorCode(error);
    if (
      code === "RESET_TOKEN_INVALID" ||
      code === "PASSWORD_REQUIRED" ||
      code === "PASSWORD_TOO_SHORT" ||
      code === "PASSWORD_TOO_LONG"
    ) {
      return { error: code };
    }
    // Nunca se propaga el mensaje crudo del error original.
    return { error: "UNKNOWN" };
  }
  redirect("/login?passwordReset=1");
}
