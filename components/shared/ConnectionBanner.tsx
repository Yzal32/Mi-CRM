"use client";

import { useEffect, useState } from "react";
import { useConvexConnectionState } from "convex/react";
import { Icon } from "@/components/ui/Icon";

const SHOW_AFTER_MS = 3000;

/**
 * `error.tsx` solo captura errores lanzados durante el render — no detecta
 * que el WebSocket de Convex se caiga o nunca llegue a conectar. Este banner
 * cubre ambos casos usando useConvexConnectionState(), con un pequeño
 * debounce para no parpadear en micro-cortes de red.
 */
export function ConnectionBanner() {
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState();
  const [disconnectedLongEnough, setDisconnectedLongEnough] = useState(false);

  useEffect(() => {
    if (isWebSocketConnected) return;
    const timer = setTimeout(() => setDisconnectedLongEnough(true), SHOW_AFTER_MS);
    // Al reconectar (o desmontar), esta limpieza corre antes del próximo
    // efecto: reinicia el flag para que la próxima desconexión vuelva a
    // esperar los 3s completos, sin llamar a setState de forma síncrona en
    // el cuerpo del efecto.
    return () => {
      clearTimeout(timer);
      setDisconnectedLongEnough(false);
    };
  }, [isWebSocketConnected]);

  const showBanner = !isWebSocketConnected && disconnectedLongEnough;
  if (!showBanner) return null;

  // hasEverConnected === false: la app nunca llegó a conectar (URL de Convex
  // incorrecta, sin red, backend caído) — sin esta rama, la pantalla se
  // quedaría en Skeleton indefinidamente sin ningún diagnóstico.
  const message = hasEverConnected ? "Reconectando…" : "No se pudo conectar";

  return (
    <div
      role="status"
      className="font-secondary flex items-center justify-center gap-2 border-b border-alert-border bg-alert-bg px-4 py-2 text-alert-text"
    >
      <Icon name="wifi-off" size={16} />
      {message}
    </div>
  );
}
