import { STATUS_OPTIONS, type ClientStatus } from "@/lib/clientes/clientOptions";

// Record literal completo — Tailwind v4 no genera clases interpoladas
// dinámicamente (`bg-status-${status}-bg` no funcionaría).
const STATUS_CLASSES: Record<ClientStatus, string> = {
  new: "bg-status-new-bg text-status-new-text",
  contacted: "bg-status-contacted-bg text-status-contacted-text",
  interested: "bg-status-interested-bg text-status-interested-text",
  won: "bg-status-won-bg text-status-won-text",
  lost: "bg-status-lost-bg text-status-lost-text",
};

const STATUS_LABELS: Record<ClientStatus, string> = Object.fromEntries(
  STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ClientStatus, string>;

export function Badge({ status }: { status: ClientStatus }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 font-caption ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
