import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { isValidBusinessDayKey } from "../../lib/shared/businessDay";

export type ActionType = "call" | "whatsapp" | "email" | "visit";

export type UpsertFollowUpArgs = {
  clientId: Id<"clients">;
  dueDate: string;
  actionType: ActionType;
  seedData?: boolean;
};

/**
 * Único punto de escritura de `followUps`. Mantiene la invariante de
 * producto "como mucho un seguimiento pendiente por cliente" mediante
 * upsert vía el índice `by_client`. Cualquier mutation futura que necesite
 * crear o actualizar un seguimiento (p. ej. la de PRO-15 "Recordatorio de
 * seguimiento", fuera de alcance de esta pantalla) DEBE reusar este helper
 * en vez de llamar a `ctx.db.insert("followUps", ...)` directamente.
 */
export async function upsertFollowUp(ctx: MutationCtx, args: UpsertFollowUpArgs) {
  if (!isValidBusinessDayKey(args.dueDate)) {
    throw new Error(`dueDate inválida: "${args.dueDate}"`);
  }

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
