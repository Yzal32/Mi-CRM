"use server";

import { redirect } from "next/navigation";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { getConvexServerClient } from "@/lib/convexServer";

export type ResetPasswordActionErrorCode =
  | "RESET_CODE_INVALID"
  | "PASSWORD_REQUIRED"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG"
  | "PASSWORD_RESET_NOT_CONFIGURED"
  | "UNKNOWN";

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
 * un restablecimiento por código de email no auto-inicia sesión, ver
 * convex/model/users.ts (resetPasswordAfterVerification) — tras un cambio
 * correcto, el usuario entra por /login con la contraseña nueva.
 * passwordReset.resetPassword es una `action` (no `mutation`, ver
 * convex/passwordReset.ts), pero se invoca igual desde aquí.
 */
export async function resetPasswordAction(
  args: { email: string; code: string; newPassword: string },
): Promise<{ error: ResetPasswordActionErrorCode } | undefined> {
  try {
    await getConvexServerClient().action(api.passwordReset.resetPassword, args);
  } catch (error) {
    const code = convexErrorCode(error);
    if (
      code === "RESET_CODE_INVALID" ||
      code === "PASSWORD_REQUIRED" ||
      code === "PASSWORD_TOO_SHORT" ||
      code === "PASSWORD_TOO_LONG" ||
      code === "PASSWORD_RESET_NOT_CONFIGURED"
    ) {
      return { error: code };
    }
    // Nunca se propaga el mensaje crudo del error original.
    return { error: "UNKNOWN" };
  }
  redirect("/login?passwordReset=1");
}
