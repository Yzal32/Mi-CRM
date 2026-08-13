import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ClienteRowContent, type ClienteRowContentProps } from "./ClienteRowContent";

export function ClienteRow({ clientId, ...content }: { clientId: string } & ClienteRowContentProps) {
  return (
    <Link
      href={`/clientes/${clientId}`}
      className="flex items-center gap-3.5 rounded-lg border border-border bg-surface px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      <ClienteRowContent {...content} />
      {/* Chevrón solo aquí: ClienteRow navega a la ficha, a diferencia de
          ClienteRowButton (selector), que no lleva ninguno — ver su docstring. */}
      <Icon name="chevron-right" size={18} className="shrink-0 text-text-tertiary" />
    </Link>
  );
}
