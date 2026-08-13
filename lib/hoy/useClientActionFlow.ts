"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

export type ClientActionIntent = "venta" | "nota";

export type SelectedClient = { clientId: Id<"clients">; name: string };

export type ClientActionFlowState =
  | { step: "idle" }
  | { step: "pickingClient"; intent: ClientActionIntent }
  | { step: "notaClient"; client: SelectedClient };

export type ClientActionFlow = {
  state: ClientActionFlowState;
  start: (intent: ClientActionIntent) => void;
  cancelPicking: () => void;
  selectClient: (client: SelectedClient) => void;
  closeNota: () => void;
};

const IDLE: ClientActionFlowState = { step: "idle" };

// Máquina de estados pura compartida entre HoyScreen (escritorio) y
// MobileTopBar (móvil, solo en la pestaña Hoy) — ver ClientActionOverlays
// para qué overlay se monta en cada paso.
export function useClientActionFlow(): ClientActionFlow {
  const router = useRouter();
  const [state, setState] = useState<ClientActionFlowState>(IDLE);

  function start(intent: ClientActionIntent) {
    setState({ step: "pickingClient", intent });
  }

  function cancelPicking() {
    setState(IDLE);
  }

  // No navega dentro de un actualizador funcional de setState: en
  // StrictMode React puede invocar esa función dos veces (la trata como
  // pura), lo que duplicaría el router.push. Se lee `state` directamente
  // del closure y se llama a router.push/setState con valores literales.
  function selectClient(client: SelectedClient) {
    if (state.step !== "pickingClient") return;
    if (state.intent === "venta") {
      router.push(`/clientes/${client.clientId}/venta`);
      setState(IDLE);
    } else {
      setState({ step: "notaClient", client });
    }
  }

  function closeNota() {
    setState(IDLE);
  }

  return { state, start, cancelPicking, selectClient, closeNota };
}
