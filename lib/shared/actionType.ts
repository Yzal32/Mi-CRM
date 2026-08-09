/**
 * Tipo de la próxima acción de un seguimiento (ver Modelo de datos:
 * Seguimiento, PRO-7). Vive en lib/shared/ — no en convex/ ni en un
 * componente de Next.js — porque lo usan ambos lados: convex/model/followUps.ts
 * (texto canónico al completar) y la UI (selector del overlay, pantalla Hoy).
 * Único punto de verdad de las etiquetas en español, para que no diverjan
 * entre sitios.
 */
export type ActionType = "call" | "whatsapp" | "email" | "visit";

export const ACTION_TYPE_LABELS_ES: Record<ActionType, string> = {
  call: "Llamar",
  whatsapp: "WhatsApp",
  email: "Email",
  visit: "Visita",
};

export const ACTION_TYPE_OPTIONS: { value: ActionType; label: string }[] = [
  { value: "call", label: "Llamar" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "visit", label: "Visita" },
];
