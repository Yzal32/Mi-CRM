import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";

export function ClienteRow({ clientId, name, phone }: { clientId: string; name: string; phone?: string }) {
  return (
    <Link
      href={`/clientes/${clientId}`}
      className="flex items-center gap-3.5 rounded-lg border border-border bg-surface px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      <Avatar name={name} size={44} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-body-medium text-text">{name}</span>
        {phone && <span className="font-secondary text-text-tertiary">{phone}</span>}
      </div>
      <Icon name="chevron-right" size={18} className="shrink-0 text-text-tertiary" />
    </Link>
  );
}
