"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useAuthedQuery } from "@/lib/convex/authedHooks";
import { useBusinessToday } from "@/lib/hoy/useBusinessToday";
import { useClientActionFlow } from "@/lib/hoy/useClientActionFlow";
import { TopBar } from "@/components/ui/TopBar";
import { IconButton } from "@/components/ui/IconButton";
import { ClientActionOverlays } from "@/components/hoy/ClientActionOverlays";
import { HoyQuickActionsOverlay } from "@/components/hoy/HoyQuickActionsOverlay";
import { extractFichaClientId, isNavItemActive, navItems } from "./navItems";

export function MobileTopBar() {
  const pathname = usePathname();
  const router = useRouter();

  // Los hooks se llaman SIEMPRE, en la misma posición, con "skip"/estado
  // inicial cuando no aplican: MobileTopBar no se desmonta al cambiar de
  // ruta, así que un hook añadido solo dentro de una rama condicional
  // (después de un return temprano) cambiaría el número de hooks entre
  // renders al navegar — viola las Rules of Hooks y puede fallar en
  // runtime, no es solo un aviso de lint. Los `return` condicionales van
  // siempre después.
  const fichaClientId = extractFichaClientId(pathname);
  const client = useAuthedQuery(api.clients.getById, fichaClientId ? { clientId: fichaClientId } : "skip");
  const today = useBusinessToday();
  const flow = useClientActionFlow();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

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
  // PRO-19: la pestaña Clientes reutiliza el mismo "+" que Hoy en vez de un
  // FAB propio (decisión de producto, evita un componente flotante nuevo
  // sin precedente en el repo). Los returns de arriba (/clientes/nuevo,
  // ficha de cliente) ya garantizan que nunca aparece ahí.
  // PRO-60: en Hoy el "+" abre un menú de 3 acciones (Nuevo cliente /
  // Registrar venta / Anotar interacción) en vez de navegar directo —
  // Clientes sigue siendo el link directo de siempre, sin cambios.
  const isClients = active?.value === "clients";
  return (
    <>
      <div className="lg:hidden">
        <TopBar
          title={active?.label ?? "Loop"}
          action={
            isHoy ? (
              <IconButton icon="plus" label="Nueva acción" variant="primary" size={36} onClick={() => setIsSheetOpen(true)} />
            ) : isClients ? (
              <IconButton icon="plus" label="Nuevo cliente" variant="primary" href="/clientes/nuevo" size={36} />
            ) : undefined
          }
        />
      </div>
      {isSheetOpen && (
        <HoyQuickActionsOverlay
          onClose={() => setIsSheetOpen(false)}
          onSelectVenta={() => {
            setIsSheetOpen(false);
            flow.start("venta");
          }}
          onSelectNota={() => {
            setIsSheetOpen(false);
            flow.start("nota");
          }}
        />
      )}
      <ClientActionOverlays flow={flow} today={today} />
    </>
  );
}
