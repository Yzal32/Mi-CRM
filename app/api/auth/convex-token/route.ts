import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import { getConvexServerClient } from "@/lib/convexServer";
import { SESSION_COOKIE_NAME, clearSessionCookie } from "@/lib/auth/session";
import { convexErrorCode } from "@/lib/shared/convexError";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

/**
 * Validación de origen fail-closed (PRO-59, ronda 4 de auditoría). Cuando el
 * navegador manda `Sec-Fetch-Site`, es autoritativo por sí solo — un
 * `Origin` correcto nunca compensa un `Sec-Fetch-Site` hostil, así que no se
 * mezclan las dos comprobaciones. Solo si el navegador no manda
 * `Sec-Fetch-Site` se recurre a comparar `Origin`. Si faltan las dos
 * cabeceras, se rechaza — nunca se trata como "sin información suficiente
 * para decidir, dejar pasar".
 */
function isSameOrigin(request: NextRequest): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite !== null) {
    return secFetchSite === "same-origin";
  }
  const origin = request.headers.get("origin");
  return origin !== null && origin === request.nextUrl.origin;
}

/**
 * Emite un accessToken de corta duración (PRO-59) a partir de la cookie
 * httpOnly de sesión — el único puente entre esa cookie (invisible para el
 * JS de cliente a propósito, ver lib/auth/session.ts) y las llamadas en vivo
 * de convex/react, que sí necesitan un valor legible desde el navegador.
 * `POST` únicamente: `GET` con SameSite=Lax es alcanzable desde una
 * navegación cross-site, y este endpoint muta estado (emite/rota
 * credenciales) — nunca debe ser cacheable ni disparable así.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return json({ error: "NO_SESSION" }, 401);
  }

  try {
    const result = await getConvexServerClient().mutation(api.sessions.issueAccessToken, { token });
    return json({ token: result.accessToken, expiresAt: result.expiresAt, serverNow: result.serverNow }, 200);
  } catch (error) {
    const code = convexErrorCode(error);
    if (code === "SESSION_INVALID") {
      // Único borrado de esta cookie a partir de esta respuesta —
      // ConvexAccessTokenProvider.tsx (cliente) no puede tocarla, es
      // httpOnly (ver su propio comentario).
      await clearSessionCookie();
      return json({ error: "SESSION_INVALID" }, 401);
    }
    if (code === "PASSWORD_CHANGE_REQUIRED") {
      return json({ error: "PASSWORD_CHANGE_REQUIRED" }, 403);
    }
    // Nunca se propaga el mensaje crudo del error original.
    return json({ error: "UNKNOWN" }, 500);
  }
}
