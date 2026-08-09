import { Icon, type IconName } from "@/components/ui/Icon";

// Fila icono + valor (p. ej. teléfono, email, canal de origen en la
// cabecera de la ficha de cliente). `label` es solo para lectores de
// pantalla — el icono ya transmite el contexto visualmente.
export function DetailRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon name={icon} size={18} className="shrink-0 text-text-tertiary" aria-hidden="true" />
      <span className="sr-only">{label}: </span>
      <span className="font-secondary text-text">{value}</span>
    </div>
  );
}
