import { Icon, type IconName } from "./Icon";
import { Button } from "./Button";

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  actionHref,
  onAction,
}: {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-circle bg-primary-soft text-primary-soft-text">
        <Icon name={icon} size={28} />
      </div>
      <h2 className="font-section-title m-0 text-text">{title}</h2>
      <p className="font-body m-0 max-w-xs text-text-secondary">{message}</p>
      {actionLabel && actionHref && (
        <Button href={actionHref} variant="primary" className="mt-2">
          {actionLabel}
        </Button>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button onClick={onAction} variant="primary" className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
