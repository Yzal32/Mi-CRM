export type OriginChannel = "web" | "social" | "email" | "whatsapp" | "referral" | "visit";
export type ClientStatus = "new" | "contacted" | "interested" | "won" | "lost";

export const ORIGIN_CHANNEL_OPTIONS: { value: OriginChannel; label: string }[] = [
  { value: "web", label: "Web" },
  { value: "social", label: "Redes sociales" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "referral", label: "Recomendación" },
  { value: "visit", label: "Visita en tienda" },
];

export const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: "new", label: "Nuevo" },
  { value: "contacted", label: "Contactado" },
  { value: "interested", label: "Interesado" },
  { value: "won", label: "Venta cerrada" },
  { value: "lost", label: "Perdido" },
];
