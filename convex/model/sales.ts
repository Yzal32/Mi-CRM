import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { businessDayKey } from "../../lib/shared/businessDay";
import { fail } from "./errors";

export type SaleErrorCode = "DESCRIPTION_REQUIRED" | "DESCRIPTION_TOO_LONG" | "INVALID_AMOUNT" | "CLIENT_NOT_FOUND";

export type CreateSaleArgs = {
  clientId: Id<"clients">;
  description: string;
  amountCents: number;
  authorId: string;
  authorName: string;
  seedData?: boolean;
  seedKey?: string;
};

const DESCRIPTION_MAX_LENGTH = 300;
const AMOUNT_MIN_CENTS = 1;
// Tope defensivo (~9.999.999,99 €), no una restricción de negocio real:
// evita errores de tecleo groseros (un cero de más), no limita precios.
const AMOUNT_MAX_CENTS = 999_999_999;

/**
 * Único punto de escritura de creación de `sales`. Función de MODELO, no
 * pública en sí misma — convex/sales.ts::create (PRO-17) es el wrapper
 * público real que expone esto al cliente, con auth y autoría de servidor.
 * convex/seed.ts sigue llamando a esta función de modelo directamente (sin
 * pasar por la mutation pública) porque necesita sembrar seedData/seedKey,
 * que la mutation pública no acepta como argumento.
 */
export async function createSale(ctx: MutationCtx, args: CreateSaleArgs): Promise<Id<"sales">> {
  const description = args.description.trim();
  if (!description) fail<SaleErrorCode>("DESCRIPTION_REQUIRED", "Describe qué se ha vendido.");
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    fail<SaleErrorCode>("DESCRIPTION_TOO_LONG", "La descripción es demasiado larga.");
  }

  if (
    !Number.isSafeInteger(args.amountCents) ||
    args.amountCents < AMOUNT_MIN_CENTS ||
    args.amountCents > AMOUNT_MAX_CENTS
  ) {
    fail<SaleErrorCode>("INVALID_AMOUNT", "Introduce un importe válido.");
  }

  const client = await ctx.db.get(args.clientId);
  if (!client) fail<SaleErrorCode>("CLIENT_NOT_FOUND", "El cliente no existe.");

  return ctx.db.insert("sales", {
    clientId: args.clientId,
    description,
    amountCents: args.amountCents,
    date: businessDayKey(new Date()),
    authorId: args.authorId,
    authorName: args.authorName,
    seedData: args.seedData,
    seedKey: args.seedKey,
  });
}
