import { ConvexError } from "convex/values";

/**
 * Único punto de construcción de errores tipados en toda la capa de
 * modelo (clients/notes/sales/followUps). Cada módulo declara su propia
 * unión de códigos (p. ej. CreateClientErrorCode) que TypeScript valida
 * contra el parámetro `code` en cada call site.
 */
export function fail<Code extends string>(code: Code, message: string): never {
  throw new ConvexError({ code, message });
}
