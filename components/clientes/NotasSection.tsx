"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { formatBusinessDate } from "@/lib/shared/businessDay";
import { ACTION_TYPE_LABELS_ES, type ActionType } from "@/lib/shared/actionType";
import { actionIcon } from "@/lib/hoy/followUpPresentation";
import { AnadirNotaOverlay } from "./AnadirNotaOverlay";

type Note = { _id: Id<"notes">; text: string; date: string; authorName: string; channel?: ActionType };

export function NotasSection({
  clientId,
  featured,
  items,
  truncated,
}: {
  clientId: Id<"clients">;
  featured: { _id: Id<"notes"> } | null;
  items: Note[];
  truncated: boolean;
}) {
  const [overlayOpen, setOverlayOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-section-title m-0 text-text">Interacciones</h2>
        <Button variant="secondary" size="sm" onClick={() => setOverlayOpen(true)}>
          Anotar interacción
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="pencil"
          title="Sin interacciones"
          message="Todavía no se ha registrado ninguna interacción con este cliente."
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((note) => (
            <li key={note._id} className="flex flex-col gap-1 border-b border-border pb-3 last:border-none last:pb-0">
              <p className="font-body m-0 text-text">{note.text}</p>
              <div className="flex items-center gap-1.5 font-caption text-text-tertiary">
                {note.channel && (
                  <Icon name={actionIcon(note.channel)} size={14} className="shrink-0" aria-hidden="true" />
                )}
                <span>
                  {note.channel && `${ACTION_TYPE_LABELS_ES[note.channel]} · `}
                  {note.authorName} · {formatBusinessDate(note.date)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {truncated && (
        <p className="font-caption m-0 text-text-tertiary">Mostrando las 500 interacciones más recientes.</p>
      )}

      {overlayOpen && (
        <AnadirNotaOverlay clientId={clientId} featured={featured} onClose={() => setOverlayOpen(false)} />
      )}
    </div>
  );
}
