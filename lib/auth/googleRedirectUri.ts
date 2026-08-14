import type { NextRequest } from "next/server";

// Cookie httpOnly de corta duración compartida entre /api/auth/google/start
// (la fija) y /api/auth/google/callback (la valida y la limpia) — un único
// nombre exportado, mismo criterio que SESSION_COOKIE_NAME en session.ts.
export const GOOGLE_OAUTH_STATE_COOKIE_NAME = "google_oauth_state";

/**
 * Calcula la `redirect_uri` de Google (PRO-63) igual en `/start` y
 * `/callback` — si divergieran, Google rechazaría el intercambio de `code`
 * (exige coincidencia exacta con lo registrado en la consola). El host lo
 * refleja bien `request.url` (Railway reenvía el `Host` real), pero no hay
 * que confiar en el esquema inferido: un proxy que termina TLS puede dejar
 * ver la conexión interna como HTTP puro. Se fuerza `https:` en producción.
 */
export function googleCallbackUrl(request: NextRequest): string {
  const url = new URL("/api/auth/google/callback", request.url);
  if (process.env.NODE_ENV === "production") {
    url.protocol = "https:";
  }
  return url.toString();
}
