import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { api } from "@/convex/_generated/api";
import { getConvexServerClient } from "@/lib/convexServer";

export const SESSION_COOKIE_NAME = "session_token";
// 400 días: tope real de Chrome/la mayoría de navegadores para `Expires` —
// no existe "sin caducar" en la práctica. Se acerca lo máximo posible a la
// regla de negocio "la sesión se mantiene hasta cierre explícito".
export const SESSION_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export type SessionUser = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "employee";
  mustChangePassword: boolean;
};

/**
 * Único punto de verificación real de sesión (DAL) — lee la cookie httpOnly
 * y la comprueba contra Convex (`sessions.verify`). `cache()` de React
 * deduplica llamadas dentro de la misma petición (p. ej. layout + page que
 * la usan ambos), no persiste entre peticiones distintas.
 *
 * `proxy.ts` NO usa esta función a propósito: solo comprueba que la cookie
 * exista (check optimista, sin tocar Convex), siguiendo la recomendación de
 * la propia documentación de Next.js de no hacer comprobaciones de base de
 * datos en el proxy. La verificación real vive aquí, más cerca de los
 * datos, y se usa desde Server Components/Actions.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return getConvexServerClient().query(api.sessions.verify, { token });
});

/** Único punto donde se fijan las opciones de la cookie de sesión. */
export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}
