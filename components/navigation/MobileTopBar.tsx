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
import { extractFichaClientId, extractVentaClientId, isNavItemActive, navItems } from "./navItems";

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
  const ventaClientId = extractVentaClientId(pathname);
  const client = useAuthedQuery(api.clients.getById, fichaClientId ? { clientId: fichaClientId } : "skip");
  const today = useBusinessToday();
  const flow = useClientActionFlow();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // isHoy se calcula ya aquí, antes de los return tempranos: el ajuste de
  // estado de abajo tiene que dispararse también al navegar a
  // /clientes/nuevo o a una ficha de cliente, no solo entre pestañas
  // genéricas (ver su docstring).
  const active = navItems.find((item) => isNavItemActive(pathname, item.href));
  const isHoy = active?.value === "today";

  // MobileTopBar NUNCA se desmonta al navegar (vive fuera de {children} en
  // el layout) — sin esto, isSheetOpen y el estado de `flow` sobrevivirían
  // un cambio de ruta: abrir "Nueva acción" en Hoy y navegar a otra pestaña
  // (o volver atrás con el navegador) dejaría el menú o el selector de
  // cliente persistiendo en memoria, reapareciendo encima de una pantalla
  // distinta a la que lo abrió y pudiendo actuar sobre un cliente fuera de
  // contexto. Patrón oficial de React para "ajustar estado cuando cambia
  // algo" SIN useEffect (evita el anti-patrón de setState síncrono dentro
  // de un efecto, que el lint del proyecto rechaza): comparar contra el
  // valor del render anterior aquí mismo, durante el render — React aplica
  // el setState antes de pintar, sin un commit visible de por medio. El
  // guard `isHoy &&` del JSX de más abajo cubre además el instante de este
  // mismo render (previousIsHoy todavía no se ha actualizado cuando se
  // evalúa el JSX más abajo).
  const [previousIsHoy, setPreviousIsHoy] = useState(isHoy);
  if (isHoy !== previousIsHoy) {
    setPreviousIsHoy(isHoy);
    if (!isHoy) {
      setIsSheetOpen(false);
      flow.reset();
    }
  }

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

  // Registrar venta (PRO-23): mismo criterio que /clientes/nuevo — título
  // fijo de la propia pantalla, no el nombre del cliente (ese ya se muestra
  // dentro del formulario). No dispara ninguna query nueva de cliente.
  if (ventaClientId) {
    return (
      <div className="lg:hidden">
        <TopBar title="Registrar venta" onBack={() => router.back()} />
      </div>
    );
  }

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
      {/* isHoy && aquí, no solo el ajuste de estado de arriba: expresa
          directamente la intención (estos overlays son solo de Hoy) en vez
          de depender de que isSheetOpen/flow.state ya estén corregidos —
          defensa adicional barata, no la única barrera. */}
      {isHoy && isSheetOpen && (
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
      {isHoy && <ClientActionOverlays flow={flow} today={today} />}
    </>
  );
}
