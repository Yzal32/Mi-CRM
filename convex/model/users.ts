import { compareSync, hashSync, truncates } from "bcryptjs";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { businessDayKey } from "../../lib/shared/businessDay";
import { isValidEmail } from "../../lib/shared/isValidEmail";
import { createSessionForUser, destroySessionsForUser, verifySession } from "./sessions";
import { EMAIL_MAX_LENGTH, MAX_PASSWORD_INPUT_LENGTH } from "./inputLimits";
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
// Medido como password.length (unidades UTF-16), igual criterio que
// NAME_MAX_LENGTH — no es una cuenta de caracteres visibles ni de bytes.
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_HASH_COST = 10;

/**
 * Comprobaciones compartidas por createUser y changePassword para cualquier
 * contraseña que se vaya a guardar (no para la que se está verificando,
 * ver convex/model/sessions.ts). Primero la cota de tamaño (protección
 * DoS): bcrypt.truncates() recorre toda la cadena en bytes UTF-8, no debe
 * ejecutarse con una entrada arbitrariamente grande. Nada se trunca en
 * silencio: bcrypt trunca cualquier entrada de más de 72 bytes UTF-8, lo
 * que permitiría que dos contraseñas distintas autenticaran contra el
 * mismo hash — por eso se rechaza explícitamente en vez de dejar que
 * bcryptjs la trunque.
 */
export function validateNewPassword(password: string): void {
  if (!password) {
    fail("PASSWORD_REQUIRED", "Introduce una contraseña.");
  }
  if (password.length > MAX_PASSWORD_INPUT_LENGTH) {
    fail("PASSWORD_TOO_LONG", "La contraseña es demasiado larga.");
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    fail("PASSWORD_TOO_SHORT", `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }
  if (truncates(password)) {
    fail("PASSWORD_TOO_LONG", "La contraseña es demasiado larga.");
  }
}

/**
 * Único punto de escritura de creación de `users`. Cualquier función futura
 * que necesite crear un usuario (provisionUser, el futuro alta de empleado
 * de PRO-45) DEBE reusar este helper, nunca ctx.db.insert directo — mismo
 * criterio que convex/model/clients.ts con createClient.
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

  validateNewPassword(args.password);
  // Síncrono a propósito: bcrypt.hash() (la variante async) cede el control
  // periódicamente con setTimeout mientras calcula, y el runtime de
  // mutations de Convex no permite temporizadores ("Can't use setTimeout in
  // queries and mutations") — confirmado ejecutándolo contra un deployment
  // real. hashSync no usa temporizadores, corre en un único tick.
  const passwordHash = hashSync(args.password, PASSWORD_HASH_COST);

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

export type ChangePasswordErrorCode =
  | "SESSION_INVALID"
  | "CURRENT_PASSWORD_INCORRECT"
  | "PASSWORD_UNCHANGED"
  | "PASSWORD_REQUIRED"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG";

export type ChangePasswordResult = { token: string };

/**
 * Único punto de cambio de contraseña — usado tanto para el cambio
 * obligatorio (mustChangePassword: true, tras provisionUser o un futuro
 * reseteo de PRO-45) como para el voluntario desde Ajustes (PRO-57). Rota
 * la sesión: cierra TODAS las sesiones del usuario, incluida la que hizo la
 * llamada, y crea una nueva — si alguien había copiado la cookie con la
 * contraseña antigua, deja de servirle (recomendación de OWASP de
 * regenerar el identificador de sesión tras un cambio de contraseña). El
 * caller (la mutation pública) es responsable de sustituir la cookie del
 * navegador por el token devuelto.
 */
export async function changePassword(
  ctx: MutationCtx,
  args: { token: string; currentPassword: string; newPassword: string },
): Promise<ChangePasswordResult> {
  const verified = await verifySession(ctx, args.token);
  if (!verified) {
    fail<ChangePasswordErrorCode>("SESSION_INVALID", "Tu sesión ha caducado. Vuelve a iniciar sesión.");
  }
  const user = await ctx.db.get(verified.userId);
  if (
    !user ||
    args.currentPassword.length > MAX_PASSWORD_INPUT_LENGTH ||
    truncates(args.currentPassword) ||
    !compareSync(args.currentPassword, user.passwordHash)
  ) {
    fail<ChangePasswordErrorCode>("CURRENT_PASSWORD_INCORRECT", "La contraseña actual no es correcta.");
  }
  // Sin esto, aprovisionar con mustChangePassword: true no obliga a nada:
  // se podría "cambiar" la temporal por sí misma y desmarcar el aviso sin
  // que la credencial efectiva cambiara. Se comprueba antes de tocar el
  // hash o rotar ninguna sesión — si se rechaza aquí, no debe pasar nada
  // más.
  if (args.newPassword === args.currentPassword) {
    fail<ChangePasswordErrorCode>("PASSWORD_UNCHANGED", "La nueva contraseña debe ser distinta de la actual.");
  }
  validateNewPassword(args.newPassword);
  await ctx.db.patch(user._id, {
    passwordHash: hashSync(args.newPassword, PASSWORD_HASH_COST),
    mustChangePassword: false,
  });
  await destroySessionsForUser(ctx, user._id);
  const token = await createSessionForUser(ctx, user._id);
  return { token };
}
