"use client";

import { usePathname } from "next/navigation";
import { TopBar } from "@/components/ui/TopBar";
import { IconButton } from "@/components/ui/IconButton";
import { isNavItemActive, navItems } from "./navItems";

export function MobileTopBar() {
  const pathname = usePathname();
  const active = navItems.find((item) => isNavItemActive(pathname, item.href));
  const isHoy = active?.value === "today";
  return (
    <div className="lg:hidden">
      <TopBar
        title={active?.label ?? "Loop"}
        action={
          isHoy ? (
            <IconButton icon="plus" label="Nuevo cliente" variant="primary" href="/clientes/nuevo" size={36} />
          ) : undefined
        }
      />
    </div>
  );
}
