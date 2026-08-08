import Link from "next/link";
import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "border border-transparent bg-primary text-primary-contrast hover:bg-primary-hover active:bg-primary-active",
  secondary: "border border-border-strong bg-surface text-primary hover:bg-primary-soft",
  ghost: "border border-transparent bg-transparent text-primary hover:bg-primary-soft",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 px-4 font-secondary",
  md: "h-11 px-5 font-button",
  lg: "h-13 px-6 font-button",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & { href?: undefined };

type ButtonAsLink = CommonProps & { href: string };

export function Button({ variant = "primary", size = "md", disabled = false, children, className, ...rest }: ButtonAsButton | ButtonAsLink) {
  const classes = clsx(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
    disabled ? "cursor-not-allowed border border-disabled-border bg-disabled-bg text-disabled-text" : VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );

  if ("href" in rest && rest.href) {
    const { href } = rest;
    return (
      <Link href={href} className={classes} aria-disabled={disabled}>
        {children}
      </Link>
    );
  }

  const buttonProps = rest as Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;
  return (
    <button type="button" disabled={disabled} className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
