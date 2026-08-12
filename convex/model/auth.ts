import type { MutationCtx, QueryCtx } from "../_generated/server";
import { verifyAccessToken, type VerifiedUser } from "./sessions";
import { fail } from "./errors";

export type RequireAccessTokenErrorCode = "UNAUTHENTICATED";

/**
 * Único punto de entrada usado por las 14 funciones públicas de negocio
 * (clients, notes, followUps, sales.listByClient, sales.create — PRO-59)
 * para exigir un
 * accessToken válido. Mensaje deliberadamente genérico — nunca distingue
 * "formato inválido" de "caducado" de "cuenta ya no activa": para un cliente
 * sin credenciales válidas, ninguna de esas distinciones debería cambiar su
 * comportamiento, y no hay razón para dar más información de la necesaria a
 * quien llama sin un token. `ConvexAuthErrorBoundary` (componente cliente)
 * reconoce este código exacto para disparar su recuperación automática.
 */
export async function requireAccessToken(ctx: QueryCtx | MutationCtx, accessToken: string): Promise<VerifiedUser> {
  const user = await verifyAccessToken(ctx, accessToken);
  if (!user) {
    fail<RequireAccessTokenErrorCode>("UNAUTHENTICATED", "No se pudo verificar la sesión.");
  }
  return user;
}
