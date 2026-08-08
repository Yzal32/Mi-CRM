import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function TopBar({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="-ml-2 flex items-center p-2 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <Icon name="arrow-left" size={22} />
        </button>
      )}
      <h1 className="font-section-title m-0 flex-1 text-text">{title}</h1>
      {action}
    </header>
  );
}
