import { clsx } from "clsx";
import { FollowUpRow } from "./FollowUpRow";
import type { FollowUpItem } from "@/lib/hoy/deriveHoyViewState";

export function FollowUpGroup({
  label,
  tone,
  items,
}: {
  label: string;
  tone: "overdue" | "today";
  items: FollowUpItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <span
        className={clsx(
          "font-caption uppercase tracking-wide",
          tone === "overdue" ? "text-alert-text" : "text-text-tertiary",
        )}
      >
        {label}
      </span>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <FollowUpRow
            key={item.followUpId}
            clientId={item.clientId}
            clientName={item.clientName}
            actionType={item.actionType}
            diffDays={item.diffDays}
            tone={tone}
          />
        ))}
      </div>
    </div>
  );
}
