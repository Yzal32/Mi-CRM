"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Icon } from "@/components/ui/Icon";
import { formatBusinessDate } from "@/lib/shared/businessDay";
import { convexErrorCode } from "@/lib/shared/convexError";

type FeaturedNote = {
  _id: Id<"notes">;
  text: string;
  date: string;
  authorName: string;
};

export function NotaDestacadaCard({ note }: { note: FeaturedNote }) {
  const unfeature = useMutation(api.notes.unfeature);
  const [error, setError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const lockRef = useRef(false);

  async function handleUnfeature() {
    if (lockRef.current) return;
    lockRef.current = true;
    setError(null);
    setIsRemoving(true);
    try {
      await unfeature({ noteId: note._id });
    } catch (err) {
      setError(convexErrorCode(err) === "NOTE_NOT_FOUND" ? "Esta nota ya no existe." : "No se pudo quitar el destacado. Inténtalo de nuevo.");
    } finally {
      setIsRemoving(false);
      lockRef.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-primary-soft bg-primary-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-primary-soft-text">
          <Icon name="star" size={16} aria-hidden="true" />
          <span className="font-caption uppercase tracking-wide">Nota destacada</span>
        </div>
        <button
          type="button"
          onClick={handleUnfeature}
          disabled={isRemoving}
          className="font-caption text-text-secondary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          Quitar destacado
        </button>
      </div>
      <p className="font-body m-0 text-text">{note.text}</p>
      <p className="font-caption m-0 text-text-tertiary">
        {note.authorName} · {formatBusinessDate(note.date)}
      </p>
      {error && (
        <p role="alert" className="font-caption text-error-text">
          {error}
        </p>
      )}
    </div>
  );
}
