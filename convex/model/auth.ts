import type { MutationCtx, QueryCtx } from "../_generated/server";
import { verifyAccessToken, type VerifiedUser } from "./sessions";
import { fail } from "./errors";

export type RequireAccessTokenErrorCode = "UNAUTHENTICATED";

/**
 * Único punto de entrada usado, directa o indirectamente (ver requireOwner
 * más abajo), por las 16 funciones públicas de negocio (clients, notes,
 * followUps, sales, users.create/resetEmployeePassword — PRO-59/PRO-45)
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

export type RequireOwnerErrorCode = RequireAccessTokenErrorCode | "FORBIDDEN";

/**
 * Igual que requireAccessToken, pero además exige role === "owner". Único
 * punto de esta comprobación — cualquier mutation restringida a la Dueña
 * (alta de empleado y reseteo de contraseña de PRO-45, baja/reactivación de
 * PRO-47, edición de rol de PRO-56) debe reusar esto, nunca comparar
 * user.role a mano.
 */
export async function requireOwner(ctx: QueryCtx | MutationCtx, accessToken: string): Promise<VerifiedUser> {
  const user = await requireAccessToken(ctx, accessToken);
  if (user.role !== "owner") {
    fail<RequireOwnerErrorCode>("FORBIDDEN", "No tienes permiso para hacer esto.");
  }
  return user;
}
