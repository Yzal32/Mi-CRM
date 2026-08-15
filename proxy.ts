import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * Next.js 16 renombró middleware.ts a proxy.ts (mismo mecanismo, runtime
 * Node.js por defecto en esta versión). Check SOLO optimista — presencia
 * de la cookie de sesión — siguiendo la recomendación explícita de la
 * documentación de Next.js de no hacer comprobaciones de base de datos
 * aquí (corre en cada ruta, incluidas las prefetcheadas). La verificación
 * real (¿token válido?, ¿cuenta activa?, ¿debe cambiar contraseña?) vive en
 * app/(app)/layout.tsx y en app/cambiar-contrasena/page.tsx, más cerca de
 * los datos — ver lib/auth/session.ts.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/login") {
    return NextResponse.next();
  }
  // PRO-67/PRO-68: recuperación de contraseña por código — igual que
  // /login, un usuario sin sesión es precisamente el caso de uso de este
  // flujo, así que ambas rutas deben quedar alcanzables sin cookie. Desde
  // PRO-68 las dos son rutas estáticas (sin segmento dinámico: el código no
  // viaja en la URL), así que ambas usan coincidencia exacta.
  if (request.nextUrl.pathname === "/recuperar-contrasena") {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname === "/restablecer-contrasena") {
    return NextResponse.next();
  }
  // PRO-59: este endpoint es el único que puede emitir/renovar el
  // accessToken de corta duración precisamente cuando la sesión ha dejado
  // de ser válida (SESSION_INVALID) — si el check optimista de aquí lo
  // interceptara antes de llegar al Route Handler, respondería siempre con
  // una redirección HTML a /login en vez de dejarle devolver su propio
  // 401/403 JSON, y ConvexAccessTokenProvider.tsx nunca podría distinguir
  // los casos. Ruta exacta, no todo `/api/*`.
  if (request.nextUrl.pathname === "/api/auth/convex-token") {
    return NextResponse.next();
  }
  // PRO-63: sin sesión es precisamente el caso de uso de "entrar con
  // Google" — si el check optimista de aquí las interceptara, ni /start ni
  // /callback llegarían nunca a ejecutarse. Rutas exactas, mismo criterio
  // que /api/auth/convex-token arriba.
  if (request.nextUrl.pathname === "/api/auth/google/start" || request.nextUrl.pathname === "/api/auth/google/callback") {
    return NextResponse.next();
  }
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
