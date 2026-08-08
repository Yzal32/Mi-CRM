"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Icon } from "@/components/ui/Icon";
import { isNavItemActive, navItems } from "./navItems";

export function TabBar() {
  const pathname = usePathname();
  // Nuevo cliente es una pantalla de formulario/detalle, no un destino de
  // pestaña — PRO-24 exige que no muestre la barra de pestañas.
  if (pathname === "/clientes/nuevo") return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-border bg-surface pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] lg:hidden">
      {navItems.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.value}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex min-w-16 flex-col items-center gap-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
              active ? "text-primary" : "text-text-tertiary",
            )}
          >
            <Icon name={item.icon} size={22} />
            <span className="font-caption">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
