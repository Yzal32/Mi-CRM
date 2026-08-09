import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { businessDayKey } from "../../lib/shared/businessDay";
import { isValidEmail } from "../../lib/shared/isValidEmail";
import { normalizePhoneKey } from "../../lib/shared/normalizePhoneKey";
import { fail } from "./errors";

export type OriginChannel = "web" | "social" | "email" | "whatsapp" | "referral" | "visit";
export type ClientStatus = "new" | "contacted" | "interested" | "won" | "lost";

export type CreateClientErrorCode =
  | "NAME_REQUIRED"
  | "NAME_TOO_LONG"
  | "CONTACT_REQUIRED"
  | "INVALID_PHONE"
  | "INVALID_EMAIL"
  | "DUPLICATE_PHONE";

export type CreateClientArgs = {
  name: string;
  phone?: string;
  email?: string;
  originChannel?: OriginChannel;
  status?: ClientStatus;
  seedData?: boolean;
  seedKey?: string;
};

const NAME_MAX_LENGTH = 200;
const EMAIL_MAX_LENGTH = 200;
const PHONE_MAX_LENGTH = 30;

/**
 * Único punto de escritura de creación de `clients`. Cualquier función
 * futura que necesite crear un cliente (la mutation pública, seed.ts, un
 * futuro import) DEBE reusar este helper, nunca ctx.db.insert directo —
 * mismo criterio que convex/model/followUps.ts con upsertFollowUp.
 *
 * Nada se trunca silenciosamente: un valor que supera su longitud máxima se
 * rechaza, no se recorta (recortar podría desincronizar el `phone` visible
 * de su `phoneKey` ya calculado, o guardar un email corrupto sin avisar).
 */
export async function createClient(ctx: MutationCtx, args: CreateClientArgs): Promise<Id<"clients">> {
  const name = args.name.trim();
  if (!name) {
    fail("NAME_REQUIRED", "Introduce el nombre del cliente.");
  }
  if (name.length > NAME_MAX_LENGTH) {
    fail("NAME_TOO_LONG", "El nombre es demasiado largo.");
  }

  const rawPhone = args.phone?.trim() ?? "";
  let phoneKey: string | undefined;
  if (rawPhone) {
    if (rawPhone.length > PHONE_MAX_LENGTH) {
      fail("INVALID_PHONE", "Ese teléfono no es válido.");
    }
    const normalized = normalizePhoneKey(rawPhone);
    if (!normalized) {
      fail("INVALID_PHONE", "Ese teléfono no es válido.");
    }
    phoneKey = normalized;
  }

  const rawEmail = args.email?.trim() ?? "";
  let email: string | undefined;
  if (rawEmail) {
    if (rawEmail.length > EMAIL_MAX_LENGTH || !isValidEmail(rawEmail)) {
      fail("INVALID_EMAIL", "Ese email no es válido.");
    }
    email = rawEmail.toLowerCase();
  }

  if (!phoneKey && !email) {
    fail("CONTACT_REQUIRED", "Necesitas al menos un teléfono o un email para guardar el cliente.");
  }

  if (phoneKey) {
    const existing = await ctx.db
      .query("clients")
      .withIndex("by_phoneKey", (q) => q.eq("phoneKey", phoneKey))
      .unique();
    if (existing) {
      fail("DUPLICATE_PHONE", "Ya existe un cliente con este teléfono.");
    }
  }

  return ctx.db.insert("clients", {
    name,
    phone: phoneKey ? rawPhone : undefined,
    phoneKey,
    email,
    originChannel: args.originChannel ?? "web",
    status: args.status ?? "new",
    signupDate: businessDayKey(new Date()),
    seedData: args.seedData,
    seedKey: args.seedKey,
  });
}

export type UpdateClientStatusErrorCode = "CLIENT_NOT_FOUND";

export type UpdateClientStatusArgs = {
  clientId: Id<"clients">;
  status: ClientStatus;
};

export async function updateClientStatus(ctx: MutationCtx, args: UpdateClientStatusArgs): Promise<void> {
  const client = await ctx.db.get(args.clientId);
  if (!client) fail<UpdateClientStatusErrorCode>("CLIENT_NOT_FOUND", "El cliente no existe.");
  await ctx.db.patch(args.clientId, { status: args.status });
}
