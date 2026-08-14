import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GOOGLE_OAUTH_STATE_COOKIE_NAME, googleCallbackUrl } from "@/lib/auth/googleRedirectUri";

const STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;
const GOOGLE_AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Arranca el login con Google (PRO-63): genera un `state` anti-CSRF, lo
 * guarda en cookie httpOnly de corta duración, y redirige a la pantalla de
 * consentimiento de Google. GET a propósito: es una navegación de página
 * completa iniciada por el propio usuario al pulsar el CTA (ver
 * LoginScreen.tsx, prefetch={false} para que Next no dispare esto solo).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=GOOGLE_LOGIN_FAILED", request.url));
  }

  const state = toHex(crypto.getRandomValues(new Uint8Array(24)));
  const redirectUri = googleCallbackUrl(request);

  const authorizeUrl = new URL(GOOGLE_AUTHORIZE_ENDPOINT);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid email");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
