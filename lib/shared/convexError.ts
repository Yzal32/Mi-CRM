import { ConvexError } from "convex/values";

/**
 * Extrae el código tipado de un error de mutation (ConvexError({code,
 * message})) — mismo patrón ya usado en NuevoClienteScreen.tsx,
 * centralizado aquí para los componentes nuevos de la ficha de cliente
 * (varios overlays/acciones lo necesitan).
 */
export function convexErrorCode(error: unknown): string | undefined {
  if (
    error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null &&
    typeof (error.data as Record<string, unknown>).code === "string"
  ) {
    return (error.data as Record<string, unknown>).code as string;
  }
  return undefined;
}
