"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { getConvexServerClient } from "@/lib/convexServer";
import { SESSION_COOKIE_NAME, setSessionCookie } from "@/lib/auth/session";

export type ChangePasswordActionErrorCode =
  | "CURRENT_PASSWORD_INCORRECT"
  | "PASSWORD_UNCHANGED"
  | "PASSWORD_REQUIRED"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG"
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
 * Sirve tanto para el cambio obligatorio (mustChangePassword: true) como
 * para el voluntario desde Ajustes (PRO-57) — la propia mutation no
 * distingue los dos casos. Rota la sesión: sustituye la cookie por el
 * token nuevo que devuelve users.changePassword (ver convex/model/users.ts).
 */
export async function changePasswordAction(
  args: { currentPassword: string; newPassword: string },
): Promise<{ error: ChangePasswordActionErrorCode } | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/login"); // sin cookie, no hay nada que cambiar

  let result;
  try {
    result = await getConvexServerClient().mutation(api.users.changePassword, { token, ...args });
  } catch (error) {
    const code = convexErrorCode(error);
    if (code === "SESSION_INVALID") redirect("/login");
    if (
      code === "CURRENT_PASSWORD_INCORRECT" ||
      code === "PASSWORD_UNCHANGED" ||
      code === "PASSWORD_REQUIRED" ||
      code === "PASSWORD_TOO_SHORT" ||
      code === "PASSWORD_TOO_LONG"
    ) {
      return { error: code };
    }
    // Nunca se propaga el mensaje crudo del error original.
    return { error: "UNKNOWN" };
  }
  await setSessionCookie(result.token); // sustituye la cookie por el token rotado
  redirect("/?passwordChanged=1"); // HoyScreen muestra un toast de confirmación y limpia el query param
}
