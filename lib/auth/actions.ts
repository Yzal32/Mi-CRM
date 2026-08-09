"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { api } from "@/convex/_generated/api";
import { getConvexServerClient } from "@/lib/convexServer";
import { SESSION_COOKIE_NAME, clearSessionCookie } from "@/lib/auth/session";

/**
 * Compartida por app/(app)/ajustes/page.tsx y
 * app/cambiar-contrasena/page.tsx. Borra la cookie y redirige a /login
 * **siempre**, incluso si Convex no responde — una caída de red no debe
 * dejar a nadie sin forma de cerrar sesión.
 */
export async function logoutAction(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    try {
      await getConvexServerClient().mutation(api.sessions.logout, { token });
    } catch {
      // Se ignora a propósito: borrar la cookie local es lo que de verdad
      // importa para quien cierra sesión. La fila de sessions, si Convex
      // sigue caído, quedará huérfana hasta que expire por otra vía.
    }
  }
  await clearSessionCookie();
  redirect("/login");
}
