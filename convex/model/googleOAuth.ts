import { fail } from "./errors";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export type GoogleOAuthErrorCode = "GOOGLE_LOGIN_FAILED";

/**
 * Pura, sin red — testable directamente. Nunca confía en un email sin
 * email_verified === true (PRO-63): es lo único que separa "Google confirmó
 * que esta cuenta es dueña de este email" de un campo cualquiera de la
 * respuesta.
 */
export function verifiedEmailFromGoogleUserinfo(userinfo: { email?: unknown; email_verified?: unknown }): string {
  if (typeof userinfo.email !== "string" || userinfo.email_verified !== true) {
    fail<GoogleOAuthErrorCode>("GOOGLE_LOGIN_FAILED", "No se pudo verificar la cuenta de Google.");
  }
  return userinfo.email;
}

/**
 * Intercambia un `code` de OAuth por el email verificado por Google —
 * canje servidor-a-servidor con `client_secret` (nunca visible fuera de
 * Convex, ver sessions.loginWithGoogle). Se usa el endpoint `userinfo` en
 * vez de verificar la firma del `id_token`: el `access_token` ya se obtuvo
 * por un canal autenticado con nuestro secreto, así que la respuesta de
 * `userinfo` viene garantizada por Google sin necesitar verificación JWK
 * adicional.
 */
export async function exchangeGoogleCodeForEmail(args: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!tokenResponse.ok) {
    fail<GoogleOAuthErrorCode>("GOOGLE_LOGIN_FAILED", "No se pudo completar el inicio de sesión con Google.");
  }
  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token?: string };
  if (!accessToken) {
    fail<GoogleOAuthErrorCode>("GOOGLE_LOGIN_FAILED", "No se pudo completar el inicio de sesión con Google.");
  }

  const userinfoResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userinfoResponse.ok) {
    fail<GoogleOAuthErrorCode>("GOOGLE_LOGIN_FAILED", "No se pudo completar el inicio de sesión con Google.");
  }
  return verifiedEmailFromGoogleUserinfo(await userinfoResponse.json());
}
