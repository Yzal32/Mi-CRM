// Cookie httpOnly de corta duración compartida entre /api/auth/google/start
// (la fija) y /api/auth/google/callback (la valida y la limpia) — un único
// nombre exportado, mismo criterio que SESSION_COOKIE_NAME en session.ts.
export const GOOGLE_OAUTH_STATE_COOKIE_NAME = "google_oauth_state";

/**
 * URL pública canónica de la app (PRO-65) — NUNCA `request.url`: en el
 * despliegue de Railway, el `Host` que ve una Route Handler dentro del
 * contenedor no es el dominio público (comprobado empíricamente: resolvía a
 * "http://localhost:8080/...", causando `redirect_uri_mismatch` en Google),
 * así que una URL absoluta construida desde ahí queda rota. `undefined` si
 * `APP_URL` no está configurada — mismo criterio de degradación que
 * GOOGLE_CLIENT_ID en start/route.ts: cada caller decide el fallback.
 */
export function appBaseUrl(): URL | undefined {
  const appUrl = process.env.APP_URL;
  return appUrl ? new URL(appUrl) : undefined;
}

/**
 * Calcula la `redirect_uri` de Google (PRO-63) igual en `/start` y
 * `/callback` a partir de la misma `base` ya resuelta — si divergieran,
 * Google rechazaría el intercambio de `code` (exige coincidencia exacta con
 * lo registrado en la consola).
 */
export function googleCallbackUrl(base: URL): string {
  return new URL("/api/auth/google/callback", base).toString();
}
