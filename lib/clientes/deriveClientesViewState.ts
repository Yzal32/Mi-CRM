import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

export type ClientesSearchResult = FunctionReturnType<typeof api.clients.list>;
export type ClientesViewState = "loading" | "empty" | "noResults" | "hasResults";

/**
 * PRO-19: ya no existe "idle" — a diferencia del buscador original
 * (PRO-10), ahora siempre hay una query en vuelo (clients.list sin término,
 * clients.search con término; ver ClientesScreen). "empty" (tabla clients
 * vacía de verdad) y "noResults" (hay término pero cero coincidencias) son
 * estados distintos: el mockup los distingue ("Aún no tienes clientes" vs
 * "Sin resultados").
 */
export function deriveClientesViewState({
  data,
  hasSearchTerm,
}: {
  data: ClientesSearchResult | undefined;
  hasSearchTerm: boolean;
}): ClientesViewState {
  if (data === undefined) return "loading";
  if (data.items.length > 0) return "hasResults";
  return hasSearchTerm ? "noResults" : "empty";
}
