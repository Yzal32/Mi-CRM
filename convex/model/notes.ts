import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { businessDayKey } from "../../lib/shared/businessDay";
import type { ActionType } from "../../lib/shared/actionType";
import { fail } from "./errors";

export type NoteErrorCode =
  | "TEXT_REQUIRED"
  | "TEXT_TOO_LONG"
  | "CLIENT_NOT_FOUND"
  | "FEATURED_NOTE_CONFLICT"
  | "NOTE_NOT_FOUND";

export type CreateNoteArgs = {
  clientId: Id<"clients">;
  text: string;
  featured?: boolean;
  // Qué nota destacada creía el cliente que había al pulsar "Guardar"/
  // "Confirmar" (o null si creía que no había ninguna) — solo relevante
  // cuando featured es true. Ver la validación de conflicto más abajo.
  expectedFeaturedNoteId?: Id<"notes"> | null;
  // Ver comentario del campo homónimo en convex/schema.ts.
  channel?: ActionType;
  authorId: string;
  authorName: string;
  seedData?: boolean;
  seedKey?: string;
};

const TEXT_MAX_LENGTH = 4000;

/**
 * Único punto de escritura de creación de `notes` (mismo criterio que
 * createClient/upsertFollowUp). Mantiene la invariante "como mucho una
 * nota destacada por cliente" de forma transaccional: si `featured` es
 * true, exige que la destacada actual coincida con `expectedFeaturedNoteId`
 * antes de sustituirla — sin esto, dos pestañas que vean ambas "sin
 * destacada" podrían crear cada una la suya, la segunda sustituyendo a la
 * primera sin que nadie haya confirmado nada de verdad (la confirmación en
 * cliente por sí sola no basta, ver AnadirNotaOverlay).
 */
export async function createNote(ctx: MutationCtx, args: CreateNoteArgs): Promise<Id<"notes">> {
  const text = args.text.trim();
  if (!text) fail<NoteErrorCode>("TEXT_REQUIRED", "Escribe el contenido de la nota.");
  if (text.length > TEXT_MAX_LENGTH) {
    fail<NoteErrorCode>("TEXT_TOO_LONG", "El texto de la nota es demasiado largo.");
  }

  const client = await ctx.db.get(args.clientId);
  if (!client) fail<NoteErrorCode>("CLIENT_NOT_FOUND", "El cliente no existe.");

  const featured = args.featured ?? false;
  if (featured) {
    const current = await ctx.db
      .query("notes")
      .withIndex("by_client_featured", (q) => q.eq("clientId", args.clientId).eq("featured", true))
      .collect();
    const currentId = current[0]?._id ?? null;
    if (currentId !== (args.expectedFeaturedNoteId ?? null)) {
      fail<NoteErrorCode>("FEATURED_NOTE_CONFLICT", "La nota destacada ha cambiado. Actualiza antes de continuar.");
    }
    for (const note of current) {
      await ctx.db.patch(note._id, { featured: false });
    }
  }

  return ctx.db.insert("notes", {
    clientId: args.clientId,
    date: businessDayKey(new Date()),
    text,
    channel: args.channel,
    featured,
    authorId: args.authorId,
    authorName: args.authorName,
    seedData: args.seedData,
    seedKey: args.seedKey,
  });
}

export type UnfeatureNoteArgs = { noteId: Id<"notes"> };

/**
 * Idempotente: si la nota ya está desmarcada, no hace ninguna escritura de
 * más. Falla si el noteId no existe en absoluto — eso sí es un error del
 * llamante, no un estado ya alcanzado.
 */
export async function unfeatureNote(ctx: MutationCtx, args: UnfeatureNoteArgs): Promise<void> {
  const note = await ctx.db.get(args.noteId);
  if (!note) fail<NoteErrorCode>("NOTE_NOT_FOUND", "La nota no existe.");
  if (!note.featured) return;
  await ctx.db.patch(args.noteId, { featured: false });
}
