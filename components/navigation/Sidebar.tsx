"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Icon } from "@/components/ui/Icon";
import { isNavItemActive, navItems } from "./navItems";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="hidden w-[220px] shrink-0 flex-col gap-1 border-r border-border bg-surface p-4 lg:flex">
      <div className="font-section-title mb-3 px-3 text-primary">Loop</div>
      {navItems.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.value}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "font-body-medium flex items-center gap-3 rounded-md px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
              active ? "bg-primary-soft text-primary-soft-text" : "text-text-secondary hover:bg-surface-sunken",
            )}
          >
            <Icon name={item.icon} size={20} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
