import type { ActionType } from "./followUpPresentation";

export type FollowUpItem = {
  followUpId: string;
  clientId: string;
  clientName: string;
  actionType: ActionType;
  diffDays: number;
};

export type ListTodayResult = {
  overdue: FollowUpItem[];
  overdueTruncated: boolean;
  today: FollowUpItem[];
  todayTruncated: boolean;
};

export type HoyViewState = "loading" | "allCaughtUp" | "noResults" | "possiblyMoreMatches" | "hasData";

/**
 * Decide qué estado renderizar sin necesidad de montar HoyScreen. El caso
 * clave es "possiblyMoreMatches": una búsqueda cuya única coincidencia real
 * cae fuera de la ventana truncada de listToday deja los arrays filtrados
 * vacíos — sin este estado dedicado, HoyScreen mostraría "Sin resultados",
 * una afirmación funcionalmente falsa (ver plan, ronda 3 de auditoría).
 */
export function deriveHoyViewState({
  data,
  hasSearchTerm,
}: {
  data: ListTodayResult | undefined;
  hasSearchTerm: boolean;
}): HoyViewState {
  if (data === undefined) return "loading";

  const isEmpty = data.overdue.length === 0 && data.today.length === 0;
  const isTruncated = data.overdueTruncated || data.todayTruncated;

  if (!hasSearchTerm) {
    // Sin búsqueda, un resultado vacío implica no truncado por construcción
    // (truncar exige haber alcanzado el límite).
    return isEmpty ? "allCaughtUp" : "hasData";
  }

  if (isEmpty) {
    return isTruncated ? "possiblyMoreMatches" : "noResults";
  }

  return "hasData";
}
