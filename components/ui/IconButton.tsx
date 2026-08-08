import Link from "next/link";
import { clsx } from "clsx";
import { Icon, type IconName } from "./Icon";

type CommonProps = {
  icon: IconName;
  label: string;
  variant?: "primary" | "secondary";
  size?: number;
};

export function IconButton({
  icon,
  label,
  variant = "secondary",
  size = 44,
  href,
  onClick,
}: CommonProps & { href?: string; onClick?: () => void }) {
  const isPrimary = variant === "primary";
  const classes = clsx(
    "flex shrink-0 items-center justify-center rounded-circle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
    isPrimary ? "bg-primary text-primary-contrast" : "border border-border-strong bg-surface text-text",
  );
  const style = { width: size, height: size };

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={classes} style={style}>
        <Icon name={icon} size={20} />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={classes} style={style}>
      <Icon name={icon} size={20} />
    </button>
  );
}
