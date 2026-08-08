import Link from "next/link";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { actionIcon, followUpLabel, type ActionType } from "@/lib/hoy/followUpPresentation";

export function FollowUpRow({
  clientId,
  clientName,
  actionType,
  diffDays,
  tone,
}: {
  clientId: string;
  clientName: string;
  actionType: ActionType;
  diffDays: number;
  tone: "overdue" | "today";
}) {
  const isOverdue = tone === "overdue";
  return (
    <Link
      href={`/clientes/${clientId}`}
      className={clsx(
        "flex items-center gap-3.5 rounded-lg border px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
        isOverdue ? "border-alert-border bg-alert-bg" : "border-border bg-surface",
      )}
    >
      <Avatar name={clientName} size={44} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-body-medium text-text">{clientName}</span>
        <div className={clsx("flex items-center gap-1.5", isOverdue ? "text-alert-text" : "text-text-tertiary")}>
          <Icon name={actionIcon(actionType)} size={15} className="shrink-0" />
          <span className="font-secondary">{followUpLabel(actionType, diffDays)}</span>
        </div>
      </div>
      <Icon name="chevron-right" size={18} className={clsx("shrink-0", isOverdue ? "text-alert-border" : "text-text-tertiary")} />
    </Link>
  );
}
