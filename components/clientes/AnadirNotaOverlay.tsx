"use client";

import { useRef, useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import { useAuthedMutation } from "@/lib/convex/authedHooks";
import type { Id } from "@/convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import { convexErrorCode } from "@/lib/shared/convexError";

const FORM_ID = "anadir-nota-form";
const TEXT_MAX_LENGTH = 4000;

type Step = "form" | "confirm";

type Props = {
  clientId: Id<"clients">;
  // La nota destacada actual (o null si no hay ninguna) — necesaria para
  // mandar expectedFeaturedNoteId al confirmar la sustitución.
  featured: { _id: Id<"notes"> } | null;
  onClose: () => void;
};

function validate(text: string): string | undefined {
  if (!text.trim()) return "Escribe el contenido de la nota.";
  if (text.trim().length > TEXT_MAX_LENGTH) return "El texto de la nota es demasiado largo.";
  return undefined;
}

export function AnadirNotaOverlay({ clientId, featured, onClose }: Props) {
  const createNote = useAuthedMutation(api.notes.create);
  const [text, setText] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [step, setStep] = useState<Step>("form");
  // Congelado en el momento de entrar en "confirm" — si `featured` cambia
  // mientras el diálogo está abierto (la query reactiva trae una nota
  // destacada distinta), la confirmación sigue actuando sobre el ID que se
  // mostró y se confirmó, no sobre el valor en vivo. El servidor sigue
  // siendo quien detecta el conflicto (FEATURED_NOTE_CONFLICT) si este ID
  // ya no es el vigente.
  const [confirmReplaceId, setConfirmReplaceId] = useState<Id<"notes"> | null>(null);
  const [textError, setTextError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Cerrojo síncrono contra doble envío — liberado en el catch para poder
  // reintentar tras un error.
  const savingRef = useRef(false);

  async function save(expectedFeaturedNoteId: Id<"notes"> | null) {
    savingRef.current = true;
    setFormError(null);
    setIsSaving(true);
    try {
      await createNote({ clientId, text: text.trim(), featured: isFeatured, expectedFeaturedNoteId });
      onClose();
    } catch (err) {
      const code = convexErrorCode(err);
      if (code === "FEATURED_NOTE_CONFLICT") {
        // No se reintenta sola: la query reactiva de `featured` ya trae el
        // estado nuevo — se vuelve al paso 1 para que el usuario confirme
        // otra vez con la información actualizada.
        setFormError("La nota destacada ha cambiado desde que abriste este formulario. Vuelve a intentarlo.");
        setStep("form");
      } else if (code === "TEXT_REQUIRED" || code === "TEXT_TOO_LONG") {
        setTextError(
          code === "TEXT_REQUIRED" ? "Escribe el contenido de la nota." : "El texto de la nota es demasiado largo.",
        );
        setStep("form");
      } else {
        setFormError("No se pudo guardar la nota. Inténtalo de nuevo.");
      }
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;

    const validation = validate(text);
    if (validation) {
      setTextError(validation);
      return;
    }
    setTextError(undefined);

    if (isFeatured && featured) {
      // Ya hay otra destacada: pide confirmación en un segundo paso del
      // mismo overlay antes de llamar a la mutation. Se congela el ID aquí.
      setConfirmReplaceId(featured._id);
      setStep("confirm");
      return;
    }

    await save(isFeatured ? (featured?._id ?? null) : null);
  }

  function handleCancelConfirm() {
    // Vuelve al paso 1 conservando el texto ya escrito — no se descarta el borrador.
    setStep("form");
  }

  async function handleConfirmReplace() {
    if (savingRef.current) return;
    await save(confirmReplaceId);
  }

  return (
    <Overlay
      title={step === "confirm" ? "¿Sustituir nota destacada?" : "Añadir nota"}
      onClose={onClose}
      contentKey={step}
      footer={
        step === "confirm" ? (
          <>
            <Button type="button" variant="secondary" onClick={handleCancelConfirm}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={handleConfirmReplace} disabled={isSaving}>
              {isSaving ? "Guardando…" : "Sustituir"}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            {/* form="..." vincula este botón (renderizado fuera del <form>,
                en el footer del Overlay) al formulario de más abajo. */}
            <Button type="submit" form={FORM_ID} variant="primary" disabled={isSaving}>
              {isSaving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        )
      }
    >
      {step === "confirm" ? (
        <p className="font-body m-0 text-text">Ya hay otra nota destacada. Si continúas, esta la sustituirá.</p>
      ) : (
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {formError && (
            <p role="alert" className="font-caption text-error-text">
              {formError}
            </p>
          )}
          <Textarea
            label="Nota"
            required
            value={text}
            onChange={(value) => {
              setText(value);
              if (textError) setTextError(undefined);
            }}
            error={textError}
            placeholder="¿Qué ha pasado con este cliente?"
          />
          <Switch label="Marcar como destacada" checked={isFeatured} onChange={setIsFeatured} />
        </form>
      )}
    </Overlay>
  );
}
