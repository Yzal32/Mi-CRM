import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { businessDayKey } from "../../lib/shared/businessDay";
import { foldDiacritics } from "../../lib/shared/foldDiacritics";
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
    nameFold: foldDiacritics(name),
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

export type UpdateClientErrorCode =
  | "CLIENT_NOT_FOUND"
  | "NAME_REQUIRED"
  | "NAME_TOO_LONG"
  | "CONTACT_REQUIRED"
  | "INVALID_PHONE"
  | "INVALID_EMAIL"
  | "DUPLICATE_PHONE";

export type UpdateClientArgs = {
  clientId: Id<"clients">;
  // Tri-estado en los 4 campos, sin excepción: `undefined` significa "no
  // tocar" (el usuario no editó ese campo), una cadena (incl. "" en
  // phone/email) significa "nuevo valor". Parcheo parcial real, no
  // sobrescritura total — evita que guardar un campo pise, sin haberlo
  // tocado, un cambio concurrente de otro campo hecho por otra sesión.
  name?: string;
  phone?: string;
  email?: string;
  originChannel?: OriginChannel;
};

/**
 * Mismas reglas de validación que createClient (nombre, contacto mínimo,
 * teléfono no duplicado), aplicadas solo a los campos presentes en `args` —
 * los ausentes conservan el valor ya guardado. CONTACT_REQUIRED se valida
 * sobre el estado final fusionado (existente + parcheado), no solo sobre
 * los campos que llegaron en esta llamada.
 */
export async function updateClient(ctx: MutationCtx, args: UpdateClientArgs): Promise<void> {
  const client = await ctx.db.get(args.clientId);
  if (!client) fail<UpdateClientErrorCode>("CLIENT_NOT_FOUND", "El cliente no existe.");

  const patch: {
    name?: string;
    phone?: string;
    phoneKey?: string;
    email?: string;
    originChannel?: OriginChannel;
    nameFold?: string;
  } = {};

  if (args.name !== undefined) {
    const name = args.name.trim();
    if (!name) {
      fail<UpdateClientErrorCode>("NAME_REQUIRED", "Introduce el nombre del cliente.");
    }
    if (name.length > NAME_MAX_LENGTH) {
      fail<UpdateClientErrorCode>("NAME_TOO_LONG", "El nombre es demasiado largo.");
    }
    patch.name = name;
    patch.nameFold = foldDiacritics(name);
  }

  let finalPhoneKey = client.phoneKey;
  if (args.phone !== undefined) {
    const rawPhone = args.phone.trim();
    if (rawPhone) {
      if (rawPhone.length > PHONE_MAX_LENGTH) {
        fail<UpdateClientErrorCode>("INVALID_PHONE", "Ese teléfono no es válido.");
      }
      const normalized = normalizePhoneKey(rawPhone);
      if (!normalized) {
        fail<UpdateClientErrorCode>("INVALID_PHONE", "Ese teléfono no es válido.");
      }
      patch.phone = rawPhone;
      patch.phoneKey = normalized;
      finalPhoneKey = normalized;
    } else {
      // ctx.db.patch borra el campo cuando se le pasa `undefined` explícito
      // (a diferencia de omitir la clave, que deja el valor existente
      // intacto) — es justo lo que se quiere aquí: el usuario borró el
      // teléfono a propósito.
      patch.phone = undefined;
      patch.phoneKey = undefined;
      finalPhoneKey = undefined;
    }
  }

  let finalEmail = client.email;
  if (args.email !== undefined) {
    const rawEmail = args.email.trim();
    if (rawEmail) {
      if (rawEmail.length > EMAIL_MAX_LENGTH || !isValidEmail(rawEmail)) {
        fail<UpdateClientErrorCode>("INVALID_EMAIL", "Ese email no es válido.");
      }
      patch.email = rawEmail.toLowerCase();
      finalEmail = patch.email;
    } else {
      patch.email = undefined;
      finalEmail = undefined;
    }
  }

  if (!finalPhoneKey && !finalEmail) {
    fail<UpdateClientErrorCode>("CONTACT_REQUIRED", "Necesitas al menos un teléfono o un email para guardar el cliente.");
  }

  if (patch.phoneKey) {
    const existing = await ctx.db
      .query("clients")
      .withIndex("by_phoneKey", (q) => q.eq("phoneKey", patch.phoneKey))
      .unique();
    if (existing && existing._id !== args.clientId) {
      fail<UpdateClientErrorCode>("DUPLICATE_PHONE", "Ya existe un cliente con este teléfono.");
    }
  }

  if (args.originChannel !== undefined) patch.originChannel = args.originChannel;

  if (Object.keys(patch).length === 0) return;

  await ctx.db.patch(args.clientId, patch);
}
