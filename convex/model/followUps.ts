import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { formatBusinessDate, isValidBusinessDayKey } from "../../lib/shared/businessDay";
import { ACTION_TYPE_LABELS_ES, type ActionType } from "../../lib/shared/actionType";
import { fail } from "./errors";
import { createNote } from "./notes";

export type FollowUpErrorCode = "INVALID_DUE_DATE" | "CLIENT_NOT_FOUND" | "FOLLOW_UP_NOT_FOUND";

export type UpsertFollowUpArgs = {
  clientId: Id<"clients">;
  dueDate: string;
  actionType: ActionType;
  assigneeId: string;
  assigneeName: string;
  seedData?: boolean;
};

/**
 * Único punto de escritura de `followUps`. Mantiene la invariante de
 * producto "como mucho un seguimiento pendiente por cliente" mediante
 * upsert vía el índice `by_client`. Cualquier mutation futura que necesite
 * crear o actualizar un seguimiento DEBE reusar este helper en vez de
 * llamar a `ctx.db.insert`/`patch` directamente.
 */
export async function upsertFollowUp(ctx: MutationCtx, args: UpsertFollowUpArgs) {
  if (!isValidBusinessDayKey(args.dueDate)) {
    fail<FollowUpErrorCode>("INVALID_DUE_DATE", `La fecha "${args.dueDate}" no es válida.`);
  }

  const client = await ctx.db.get(args.clientId);
  if (!client) fail<FollowUpErrorCode>("CLIENT_NOT_FOUND", "El cliente no existe.");

  const existing = await ctx.db
    .query("followUps")
    .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
    .collect();

  if (existing.length > 1) {
    // Estado corrupto (no debería ocurrir si todos los writers pasan por
    // este helper): política determinista — se conserva la fila más
    // reciente y se borran las demás antes de continuar con el upsert.
    existing.sort((a, b) => b._creationTime - a._creationTime);
    for (const duplicate of existing.slice(1)) {
      await ctx.db.delete(duplicate._id);
    }
  }

  const survivor = existing[0];
  if (survivor) {
    await ctx.db.patch(survivor._id, args);
    return survivor._id;
  }
  return ctx.db.insert("followUps", args);
}

export type DiscardFollowUpArgs = { followUpId: Id<"followUps"> };

/** Descartar: borra el seguimiento sin generar ninguna nota. */
export async function discardFollowUp(ctx: MutationCtx, args: DiscardFollowUpArgs): Promise<void> {
  const followUp = await ctx.db.get(args.followUpId);
  if (!followUp) fail<FollowUpErrorCode>("FOLLOW_UP_NOT_FOUND", "El seguimiento no existe.");
  await ctx.db.delete(args.followUpId);
}

export type CompleteFollowUpArgs = {
  followUpId: Id<"followUps">;
  authorId: string;
  authorName: string;
};

function buildCompletionNoteText(actionType: ActionType, dueDate: string): string {
  return `Seguimiento completado: ${ACTION_TYPE_LABELS_ES[actionType]} (${formatBusinessDate(dueDate)}).`;
}

/**
 * Completar: crea una nota NO destacada con un texto canónico — con la
 * fecha PREVISTA original en el texto, no la de hoy (la nota en sí lleva
 * `date` de hoy, igual que cualquier otra nota, vía createNote) — y borra
 * el seguimiento. Convex ejecuta la mutation en una única transacción: si
 * createNote falla (p. ej. CLIENT_NOT_FOUND en un followUp huérfano), el
 * followUp no llega a borrarse, no hace falta compensación manual.
 */
export async function completeFollowUp(ctx: MutationCtx, args: CompleteFollowUpArgs): Promise<Id<"notes">> {
  const followUp = await ctx.db.get(args.followUpId);
  if (!followUp) fail<FollowUpErrorCode>("FOLLOW_UP_NOT_FOUND", "El seguimiento no existe.");

  const noteId = await createNote(ctx, {
    clientId: followUp.clientId,
    text: buildCompletionNoteText(followUp.actionType, followUp.dueDate),
    featured: false,
    authorId: args.authorId,
    authorName: args.authorName,
  });

  await ctx.db.delete(args.followUpId);
  return noteId;
}
