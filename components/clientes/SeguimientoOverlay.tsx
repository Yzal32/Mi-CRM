"use client";

import { useRef, useState, type FormEvent, type RefObject } from "react";
import { api } from "@/convex/_generated/api";
import { useAuthedMutation } from "@/lib/convex/authedHooks";
import type { Id } from "@/convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { DateShortcutChips } from "@/components/ui/DateShortcutChips";
import { ACTION_TYPE_OPTIONS, type ActionType } from "@/lib/shared/actionType";
import { convexErrorCode } from "@/lib/shared/convexError";

const FORM_ID = "seguimiento-form";

type Props = {
  clientId: Id<"clients">;
  followUp: { dueDate: string; actionType: ActionType } | null;
  today: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
};

/**
 * Sirve tanto para "marcar" (followUp null) como para "reprogramar" (ya
 * hay uno) — el tipo de acción es editable en ambos casos.
 */
export function SeguimientoOverlay({ clientId, followUp, today, returnFocusRef, onClose }: Props) {
  const upsert = useAuthedMutation(api.followUps.upsert);
  const [dueDate, setDueDate] = useState(followUp?.dueDate ?? "");
  const [actionType, setActionType] = useState<ActionType>(followUp?.actionType ?? "call");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Cerrojo síncrono contra doble envío — mismo patrón que NuevoClienteScreen.tsx.
  const savingRef = useRef(false);

  const canSave = dueDate.length > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current || !canSave) return;

    savingRef.current = true;
    setError(null);
    setIsSaving(true);
    try {
      await upsert({ clientId, dueDate, actionType });
      onClose();
    } catch (err) {
      const code = convexErrorCode(err);
      setError(
        code === "CLIENT_NOT_FOUND"
          ? "Este cliente ya no existe."
          : code === "DUE_DATE_IN_PAST"
            ? "No puedes elegir una fecha pasada."
            : "No se pudo guardar el seguimiento. Inténtalo de nuevo.",
      );
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <Overlay
      title={followUp ? "Reprogramar seguimiento" : "Marcar seguimiento"}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          {/* form="..." vincula este botón (renderizado fuera del <form>,
              en el footer del Overlay) al formulario de más abajo — patrón
              estándar HTML5, no un hack. */}
          <Button type="submit" form={FORM_ID} variant="primary" disabled={!canSave || isSaving}>
            {isSaving ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="font-caption text-error-text">
            {error}
          </p>
        )}

        <Select
          label="Tipo de próxima acción"
          value={actionType}
          onChange={(value) => setActionType(value as ActionType)}
          options={ACTION_TYPE_OPTIONS}
        />

        <div className="flex flex-col gap-2.5">
          <DateShortcutChips today={today} dueDate={dueDate} onSelect={setDueDate} />
          <label className="flex flex-col gap-1.5">
            <span className="font-caption text-text-secondary">Fecha</span>
            <input
              type="date"
              value={dueDate}
              min={today}
              onChange={(event) => setDueDate(event.target.value)}
              className="h-11 rounded-md border border-border bg-surface px-4 font-body text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            />
          </label>
        </div>
      </form>
    </Overlay>
  );
}
