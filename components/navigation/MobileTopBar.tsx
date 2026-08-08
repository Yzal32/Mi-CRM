"use client";

import { usePathname, useRouter } from "next/navigation";
import { TopBar } from "@/components/ui/TopBar";
import { IconButton } from "@/components/ui/IconButton";
import { isNavItemActive, navItems } from "./navItems";

export function MobileTopBar() {
  const pathname = usePathname();
  const router = useRouter();

  // Nuevo cliente es una pantalla de formulario/detalle, no un destino de
  // pestaña: título propio y botón atrás a la pantalla que la abrió
  // (PRO-24), en vez del título genérico de la pestaña activa.
  if (pathname === "/clientes/nuevo") {
    return (
      <div className="lg:hidden">
        <TopBar title="Nuevo cliente" onBack={() => router.back()} />
      </div>
    );
  }

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
