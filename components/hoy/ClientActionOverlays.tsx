"use client";

import { api } from "@/convex/_generated/api";
import { useAuthedQuery } from "@/lib/convex/authedHooks";
import type { ClientActionFlow, ClientActionIntent } from "@/lib/hoy/useClientActionFlow";
import { Overlay } from "@/components/ui/Overlay";
import { Skeleton } from "@/components/ui/Skeleton";
import { SeleccionarClienteOverlay } from "@/components/clientes/SeleccionarClienteOverlay";
import { AnadirNotaOverlay } from "@/components/clientes/AnadirNotaOverlay";

const PICKER_TITLES: Record<ClientActionIntent, string> = {
  venta: "Registrar venta",
  nota: "Anotar interacción",
};

// Traduce flow.state al overlay que corresponde — nunca hay dos overlays
// montados a la vez, así que se cumple sin coordinación extra la regla ya
// establecida en el resto de la app ("solo un overlay abierto a la vez").
export function ClientActionOverlays({ flow, today }: { flow: ClientActionFlow; today: string }) {
  const { state, cancelPicking, selectClient, closeNota } = flow;

  // "skip" fuera de notaClient: nunca se piden las notas de un cliente que
  // todavía no se ha elegido.
  const notes = useAuthedQuery(
    api.notes.listByClient,
    state.step === "notaClient" ? { clientId: state.client.clientId } : "skip",
  );

  if (state.step === "pickingClient") {
    return (
      <SeleccionarClienteOverlay
        title={PICKER_TITLES[state.intent]}
        today={today}
        onSelect={selectClient}
        onClose={cancelPicking}
      />
    );
  }

  if (state.step === "notaClient") {
    // Título ya fijo en "Anotar interacción" mientras carga (el mismo que
    // usará AnadirNotaOverlay para su paso de formulario) — evita que la
    // cabecera del overlay parpadee al pasar del skeleton al formulario real.
    if (notes === undefined) {
      return (
        <Overlay title="Anotar interacción" onClose={closeNota}>
          <Skeleton rows={2} />
        </Overlay>
      );
    }
    return <AnadirNotaOverlay clientId={state.client.clientId} featured={notes.featured} onClose={closeNota} />;
  }

  return null;
}
