"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { actionIcon } from "@/lib/hoy/followUpPresentation";
import { ACTION_TYPE_LABELS_ES, type ActionType } from "@/lib/shared/actionType";
import { seguimientoDateLabel } from "@/lib/clientes/seguimientoDateLabel";
import { convexErrorCode } from "@/lib/shared/convexError";
import { SeguimientoOverlay } from "./SeguimientoOverlay";

type FollowUp = {
  _id: Id<"followUps">;
  dueDate: string;
  actionType: ActionType;
};

export function SeguimientoCard({
  clientId,
  followUp,
  today,
}: {
  clientId: Id<"clients">;
  followUp: FollowUp | null;
  today: string;
}) {
  const complete = useMutation(api.followUps.complete);
  const discard = useMutation(api.followUps.discard);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Cerrojo compartido por Completar/Descartar: solo una acción tiene
  // sentido a la vez sobre el mismo seguimiento — sin él, dos clics
  // rápidos en "Completar" pueden lanzar dos mutations, la segunda con
  // FOLLOW_UP_NOT_FOUND tras un éxito real.
  const lockRef = useRef(false);
  // Respaldo de foco para el Overlay: el botón "Marcar seguimiento" del
  // EmptyState desaparece en cuanto se guarda el primer seguimiento
  // (sustituido por la vista con datos), así que no sigue conectado al DOM
  // cuando el overlay se cierra.
  const headingRef = useRef<HTMLHeadingElement>(null);

  async function handleComplete() {
    if (lockRef.current || !followUp) return;
    lockRef.current = true;
    setError(null);
    setBusy(true);
    try {
      await complete({ followUpId: followUp._id });
    } catch (err) {
      setError(
        convexErrorCode(err) === "FOLLOW_UP_NOT_FOUND"
          ? "Este seguimiento ya no existe."
          : "No se pudo completar el seguimiento. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  }

  async function handleDiscard() {
    if (lockRef.current || !followUp) return;
    if (!window.confirm("¿Descartar este seguimiento? No se guardará ninguna nota.")) return;
    lockRef.current = true;
    setError(null);
    setBusy(true);
    try {
      await discard({ followUpId: followUp._id });
    } catch (err) {
      setError(
        convexErrorCode(err) === "FOLLOW_UP_NOT_FOUND"
          ? "Este seguimiento ya no existe."
          : "No se pudo descartar el seguimiento. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <h2 ref={headingRef} tabIndex={-1} className="font-section-title m-0 text-text outline-none">
        Seguimiento
      </h2>

      {!followUp ? (
        <EmptyState
          icon="calendar-check"
          title="Sin seguimiento"
          message="No hay ningún próximo contacto marcado para este cliente."
          actionLabel="Marcar seguimiento"
          onAction={() => setOverlayOpen(true)}
        />
      ) : (
        <>
          <div className="flex items-center gap-2.5">
            <Icon name={actionIcon(followUp.actionType)} size={18} className="shrink-0 text-text-tertiary" aria-hidden="true" />
            <span className="font-body text-text">
              {ACTION_TYPE_LABELS_ES[followUp.actionType]} · {seguimientoDateLabel(followUp.dueDate, today)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="primary" size="sm" onClick={handleComplete} disabled={busy}>
              Completar
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setOverlayOpen(true)} disabled={busy}>
              Reprogramar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={busy}>
              Descartar
            </Button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="font-caption text-error-text">
          {error}
        </p>
      )}

      {overlayOpen && (
        <SeguimientoOverlay
          clientId={clientId}
          followUp={followUp}
          today={today}
          returnFocusRef={headingRef}
          onClose={() => setOverlayOpen(false)}
        />
      )}
    </div>
  );
}
