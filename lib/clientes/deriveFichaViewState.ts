import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

export type FichaViewState = "loading" | "notFound" | "ready";

/**
 * clients.getById ya codifica "cargando" (undefined, useQuery todavía sin
 * resolver) vs "no encontrado" (null, tanto para un ID malformado como
 * para uno válido pero borrado — se tratan igual) vs "listo" (el cliente).
 * Las tres queries dependientes (notes/sales/followUps) se lanzan con
 * "skip" hasta que este estado es "ready" — ver FichaClienteScreen.
 */
export function deriveFichaViewState(
  client: FunctionReturnType<typeof api.clients.getById> | undefined,
): FichaViewState {
  if (client === undefined) return "loading";
  if (client === null) return "notFound";
  return "ready";
}
