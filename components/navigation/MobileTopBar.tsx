"use client";

import { usePathname } from "next/navigation";
import { TopBar } from "@/components/ui/TopBar";
import { isNavItemActive, navItems } from "./navItems";

export function MobileTopBar() {
  const pathname = usePathname();
  const active = navItems.find((item) => isNavItemActive(pathname, item.href));
  return (
    <div className="lg:hidden">
      <TopBar title={active?.label ?? "Loop"} />
    </div>
  );
}
