import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

export type ClientesSearchResult = FunctionReturnType<typeof api.clients.search>;
export type ClientesViewState = "idle" | "loading" | "noResults" | "hasResults";

/**
 * "idle" existe porque, a diferencia de Hoy (que siempre llama a
 * listToday), aquí no se llama a clients.search en absoluto sin término
 * (ver ClientesScreen: useAuthedQuery con "skip") — por eso hasSearchTerm
 * se comprueba ANTES que data === undefined, para no confundir "no hay
 * término todavía" con "la query está en vuelo".
 */
export function deriveClientesViewState({
  data,
  hasSearchTerm,
}: {
  data: ClientesSearchResult | undefined;
  hasSearchTerm: boolean;
}): ClientesViewState {
  if (!hasSearchTerm) return "idle";
  if (data === undefined) return "loading";
  return data.items.length === 0 ? "noResults" : "hasResults";
}
