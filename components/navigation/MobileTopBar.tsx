"use client";

import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TopBar } from "@/components/ui/TopBar";
import { IconButton } from "@/components/ui/IconButton";
import { extractFichaClientId, isNavItemActive, navItems } from "./navItems";

export function MobileTopBar() {
  const pathname = usePathname();
  const router = useRouter();

  // El hook se llama SIEMPRE, en la misma posición, con "skip" cuando no
  // aplica: MobileTopBar no se desmonta al cambiar de ruta, así que un
  // useQuery añadido solo dentro de una rama condicional (después de un
  // return temprano) cambiaría el número de hooks entre renders al
  // navegar — viola las Rules of Hooks y puede fallar en runtime, no es
  // solo un aviso de lint. Los `return` condicionales van siempre después.
  const fichaClientId = extractFichaClientId(pathname);
  const client = useQuery(api.clients.getById, fichaClientId ? { clientId: fichaClientId } : "skip");

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

  // Ficha de cliente: mismo criterio (PRO-24) — título con el nombre real
  // del cliente en cuanto la query resuelve, botón atrás a quien la abrió.
  if (fichaClientId) {
    return (
      <div className="lg:hidden">
        <TopBar title={client?.name ?? "Cliente"} onBack={() => router.back()} />
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
