import { hashSync, truncates } from "bcryptjs";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { businessDayKey } from "../../lib/shared/businessDay";
import { isValidEmail } from "../../lib/shared/isValidEmail";
import { fail } from "./errors";

export type UserRole = "owner" | "employee";

export type CreateUserErrorCode =
  | "NAME_REQUIRED"
  | "NAME_TOO_LONG"
  | "EMAIL_REQUIRED"
  | "INVALID_EMAIL"
  | "EMAIL_TOO_LONG"
  | "DUPLICATE_EMAIL"
  | "PASSWORD_REQUIRED"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG";

export type CreateUserArgs = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  // Obligatorio, sin valor por defecto: en este CRM no hay registro
  // autónomo, toda alta (provisionUser hoy, alta de empleado en PRO-45
  // después) es una contraseña elegida por otra persona (la Dueña o quien
  // aprovisiona), así que cada caller debe decidir explícitamente si obliga
  // a cambiarla. Un default silencioso permitiría que un futuro caller se
  // olvide del flag y una contraseña provisional se vuelva permanente sin
  // que nadie lo note.
  mustChangePassword: boolean;
  seedData?: boolean;
  seedKey?: string;
};

const NAME_MAX_LENGTH = 200;
const EMAIL_MAX_LENGTH = 200;
// Medido como password.length (unidades UTF-16), igual criterio que
// NAME_MAX_LENGTH — no es una cuenta de caracteres visibles ni de bytes.
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_HASH_COST = 10;

/**
 * Único punto de escritura de creación de `users`. Cualquier función futura
 * que necesite crear un usuario (provisionUser, el futuro alta de empleado
 * de PRO-45) DEBE reusar este helper, nunca ctx.db.insert directo — mismo
 * criterio que convex/model/clients.ts con createClient.
 *
 * Nada se trunca silenciosamente, tampoco la contraseña: bcrypt trunca en
 * silencio cualquier entrada de más de 72 bytes UTF-8 (con Unicode, eso
 * puede alcanzarse con muchos menos de 72 caracteres), lo que permitiría que
 * dos contraseñas distintas autenticaran contra el mismo hash — por eso se
 * rechaza explícitamente con PASSWORD_TOO_LONG en vez de dejar que bcryptjs
 * la trunque.
 */
export async function createUser(ctx: MutationCtx, args: CreateUserArgs): Promise<Id<"users">> {
  const name = args.name.trim();
  if (!name) {
    fail("NAME_REQUIRED", "Introduce el nombre del usuario.");
  }
  if (name.length > NAME_MAX_LENGTH) {
    fail("NAME_TOO_LONG", "El nombre es demasiado largo.");
  }

  const rawEmail = args.email.trim();
  if (!rawEmail) {
    fail("EMAIL_REQUIRED", "Introduce el email del usuario.");
  }
  if (rawEmail.length > EMAIL_MAX_LENGTH || !isValidEmail(rawEmail)) {
    fail("INVALID_EMAIL", "Ese email no es válido.");
  }
  const email = rawEmail.toLowerCase();

  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (existing) {
    fail("DUPLICATE_EMAIL", "Ya hay una cuenta con ese email.");
  }

  const password = args.password;
  if (!password) {
    fail("PASSWORD_REQUIRED", "Introduce una contraseña.");
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    fail("PASSWORD_TOO_SHORT", `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }
  if (truncates(password)) {
    fail("PASSWORD_TOO_LONG", "La contraseña es demasiado larga.");
  }
  // Síncrono a propósito: bcrypt.hash() (la variante async) cede el control
  // periódicamente con setTimeout mientras calcula, y el runtime de
  // mutations de Convex no permite temporizadores ("Can't use setTimeout in
  // queries and mutations") — confirmado ejecutándolo contra un deployment
  // real. hashSync no usa temporizadores, corre en un único tick.
  const passwordHash = hashSync(password, PASSWORD_HASH_COST);

  return ctx.db.insert("users", {
    name,
    email,
    passwordHash,
    role: args.role,
    status: "active",
    createdDate: businessDayKey(new Date()),
    mustChangePassword: args.mustChangePassword,
    seedData: args.seedData,
    seedKey: args.seedKey,
  });
}
