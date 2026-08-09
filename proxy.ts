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
