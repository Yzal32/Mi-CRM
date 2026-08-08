import type { IconName } from "@/components/ui/Icon";

export type ActionType = "call" | "whatsapp" | "email" | "visit";

const ACTION_ICON: Record<ActionType, IconName> = {
  call: "phone",
  whatsapp: "message-circle",
  email: "mail",
  visit: "map-pin",
};

const ACTION_LABEL: Record<ActionType, string> = {
  call: "Llamar",
  whatsapp: "WhatsApp",
  email: "Email",
  visit: "Visita",
};

export function actionIcon(actionType: ActionType): IconName {
  return ACTION_ICON[actionType];
}

function timingSuffix(diffDays: number): string {
  if (diffDays <= 0) return "hoy";
  if (diffDays === 1) return "venció ayer";
  return `hace ${diffDays} días`;
}

export function followUpLabel(actionType: ActionType, diffDays: number): string {
  return `${ACTION_LABEL[actionType]} · ${timingSuffix(diffDays)}`;
}
