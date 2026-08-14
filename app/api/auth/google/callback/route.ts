import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import { getConvexServerClient } from "@/lib/convexServer";
import { setSessionCookie } from "@/lib/auth/session";
import { GOOGLE_OAUTH_STATE_COOKIE_NAME, appBaseUrl, googleCallbackUrl } from "@/lib/auth/googleRedirectUri";
import { convexErrorCode } from "@/lib/shared/convexError";

function redirectWithError(base: URL, code: string): NextResponse {
  const url = new URL("/login", base);
  url.searchParams.set("error", code);
  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, "", { path: "/api/auth/google", maxAge: 0 });
  return response;
}

/**
 * Completa el login con Google (PRO-63). Valida `state` contra la cookie —
 * protección CSRF estándar de OAuth: sin esto, alguien podría fabricar una
 * URL de callback con un `code` de SU PROPIA cuenta de Google y conseguir
 * que la víctima acabe logueada como el atacante; el `state`, atado a una
 * cookie que solo /start pudo fijar en el navegador de la víctima, lo
 * impide. Con `state` válido, delega en la action de Convex (único punto
 * que verifica el email con Google y crea sesión) y fija la cookie de
 * sesión — mismo criterio que loginAction (app/login/actions.ts).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const base = appBaseUrl();
  if (!base) {
    return NextResponse.redirect(new URL("/login?error=GOOGLE_LOGIN_FAILED", request.url));
  }

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const hasGoogleError = params.get("error") !== null;
  const expectedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)?.value;

  if (hasGoogleError || !code || !state || !expectedState || state !== expectedState) {
    return redirectWithError(base, "GOOGLE_LOGIN_FAILED");
  }

  const redirectUri = googleCallbackUrl(base);
  try {
    const result = await getConvexServerClient().action(api.sessions.loginWithGoogle, { code, redirectUri });
    await setSessionCookie(result.token);
    const response = NextResponse.redirect(new URL(result.mustChangePassword ? "/cambiar-contrasena" : "/", base));
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, "", { path: "/api/auth/google", maxAge: 0 });
    return response;
  } catch (error) {
    const code2 = convexErrorCode(error);
    return redirectWithError(base, code2 === "ACCOUNT_NOT_PROVISIONED" || code2 === "ACCOUNT_INACTIVE" ? code2 : "GOOGLE_LOGIN_FAILED");
  }
}
