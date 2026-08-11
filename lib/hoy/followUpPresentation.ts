import type { IconName } from "@/components/ui/Icon";
import { ACTION_TYPE_LABELS_ES, type ActionType } from "@/lib/shared/actionType";

// Reexportado para no romper los imports existentes (components/hoy/FollowUpRow.tsx,
// lib/hoy/deriveHoyViewState.ts) — la definición real vive en lib/shared/actionType.ts,
// compartida con convex/model/followUps.ts.
export type { ActionType };

const ACTION_ICON: Record<ActionType, IconName> = {
  call: "phone",
  whatsapp: "message-circle",
  email: "mail",
  visit: "map-pin",
};

export function actionIcon(actionType: ActionType): IconName {
  return ACTION_ICON[actionType];
}

// diffDays negativo = seguimiento futuro (PRO-19: clients.search/list, a
// diferencia de listToday, que nunca pasa negativo aquí — por eso este
// caso no se había ejercitado hasta ahora).
function timingSuffix(diffDays: number): string {
  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "venció ayer";
  if (diffDays > 1) return `hace ${diffDays} días`;
  if (diffDays === -1) return "mañana";
  return `en ${Math.abs(diffDays)} días`;
}

export function followUpLabel(actionType: ActionType, diffDays: number): string {
  return `${ACTION_TYPE_LABELS_ES[actionType]} · ${timingSuffix(diffDays)}`;
}
