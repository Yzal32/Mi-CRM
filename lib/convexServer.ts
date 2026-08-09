import "server-only";
import { ConvexHttpClient } from "convex/browser";

/**
 * Factoría mínima compartida por el DAL de sesión y las Server Actions de
 * login/logout/cambio de contraseña — son las únicas piezas que hablan con
 * Convex desde fuera del navegador (para poder fijar la cookie httpOnly en
 * la misma respuesta). `import "server-only"` evita que esto se cuele por
 * error en un bundle de cliente.
 */
export function getConvexServerClient(): ConvexHttpClient {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL as string);
}
