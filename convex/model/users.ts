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

// Mismos códigos de error que createUser salvo EMAIL_TOO_LONG: la validación
// reutilizada (rawEmail.length > EMAIL_MAX_LENGTH || !isValidEmail(rawEmail))
// siempre falla con INVALID_EMAIL para ambos casos, así que ese literal no
// llegaría a usarse nunca — no declararlo aquí evita el desajuste tipo/código
// real que sí arrastra CreateUserErrorCode.
export type UpdateUserEmailErrorCode = "USER_NOT_FOUND" | "EMAIL_REQUIRED" | "INVALID_EMAIL" | "DUPLICATE_EMAIL";

/**
 * Vía administrativa genérica para corregir el email de un usuario ya
 * existente (hoy sin pantalla propia — ver users.updateEmail, internalMutation
 * solo por CLI). Reutiliza exactamente la misma validación/normalización de
 * email que createUser para que un formato inválido o un duplicado no puedan
 * colarse por esta vía. No toca passwordHash, mustChangePassword ni sesiones
 * activas: corregir el email de la misma persona no es un cambio de
 * credencial, no hay motivo de seguridad para rotarlas.
 */
export async function updateUserEmail(ctx: MutationCtx, args: { userId: Id<"users">; email: string }): Promise<void> {
  const user = await ctx.db.get(args.userId);
  if (!user) {
    fail<UpdateUserEmailErrorCode>("USER_NOT_FOUND", "Ese usuario ya no existe.");
  }

  const rawEmail = args.email.trim();
  if (!rawEmail) {
    fail<UpdateUserEmailErrorCode>("EMAIL_REQUIRED", "Introduce el email del usuario.");
  }
  if (rawEmail.length > EMAIL_MAX_LENGTH || !isValidEmail(rawEmail)) {
    fail<UpdateUserEmailErrorCode>("INVALID_EMAIL", "Ese email no es válido.");
  }
  const email = rawEmail.toLowerCase();

  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (existing && existing._id !== user._id) {
    fail<UpdateUserEmailErrorCode>("DUPLICATE_EMAIL", "Ya hay una cuenta con ese email.");
  }

  await ctx.db.patch(user._id, { email });
}

export type ResetEmployeePasswordErrorCode = "USER_NOT_FOUND" | "NOT_AN_EMPLOYEE";
export type ResetEmployeePasswordResult = { temporaryPassword: string };

const TEMP_PASSWORD_LENGTH = 8;
// Exportado (no solo local) para que el test pueda construir un regex a
// partir de esta constante exacta, en vez de teclear una clase de
// caracteres a mano que podría divergir del alfabeto real — un desajuste
// así haría fallar el test de forma NO determinista (solo cuando el sorteo
// aleatorio tocara el carácter en desacuerdo), no en cada ejecución.
export const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // sin I, O, L/l, 0, 1

function generateTemporaryPassword(): string {
  const alphabetLength = TEMP_PASSWORD_ALPHABET.length;
  // Descarta bytes >= este límite para no sesgar el módulo hacia los
  // primeros 256 % alphabetLength caracteres del alfabeto.
  const maxUnbiased = Math.floor(256 / alphabetLength) * alphabetLength;
  let result = "";
  while (result.length < TEMP_PASSWORD_LENGTH) {
    const [byte] = crypto.getRandomValues(new Uint8Array(1));
    if (byte >= maxUnbiased) continue;
    result += TEMP_PASSWORD_ALPHABET[byte % alphabetLength];
  }
  return result;
}

/**
 * Reseteo por la Dueña, no por el propio empleado (a diferencia de
 * changePassword, que exige currentPassword) — restringido a cuentas
 * role "employee": no tiene sentido usarlo sobre la propia Dueña. La
 * contraseña generada ya cumple el mínimo/máximo de validateNewPassword
 * por construcción (8 caracteres del alfabeto fijo), así que no hace falta
 * revalidarla. Rota las sesiones del empleado igual que changePassword:
 * credencial nueva, sesiones viejas fuera.
 */
export async function resetEmployeePassword(
  ctx: MutationCtx,
  args: { userId: Id<"users"> },
): Promise<ResetEmployeePasswordResult> {
  const user = await ctx.db.get(args.userId);
  if (!user) {
    fail<ResetEmployeePasswordErrorCode>("USER_NOT_FOUND", "Ese usuario ya no existe.");
  }
  if (user.role !== "employee") {
    fail<ResetEmployeePasswordErrorCode>("NOT_AN_EMPLOYEE", "Esa cuenta no es de un empleado.");
  }

  const temporaryPassword = generateTemporaryPassword();
  await ctx.db.patch(user._id, {
    passwordHash: hashSync(temporaryPassword, PASSWORD_HASH_COST),
    mustChangePassword: true,
  });
  await destroySessionsForUser(ctx, user._id);
  return { temporaryPassword };
}

export type SetEmployeeStatusErrorCode = "USER_NOT_FOUND" | "NOT_AN_EMPLOYEE";

/**
 * Compartido por deactivateEmployee/reactivateEmployee (PRO-47): misma
 * comprobación exacta que resetEmployeePassword — restringido a cuentas
 * role "employee", nunca a la propia Dueña ni a otra cuenta "owner".
 */
async function findEmployeeOrFail(ctx: MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) {
    fail<SetEmployeeStatusErrorCode>("USER_NOT_FOUND", "Ese usuario ya no existe.");
  }
  if (user.role !== "employee") {
    fail<SetEmployeeStatusErrorCode>("NOT_AN_EMPLOYEE", "Esa cuenta no es de un empleado.");
  }
  return user;
}

/**
 * Baja de empleado (PRO-47): no borra la cuenta, solo status -> "inactive".
 * La revocación funcional ya es inmediata en cuanto cambia el status (ver
 * findActiveSession/verifyAccessToken en convex/model/sessions.ts); además
 * se destruyen físicamente las sesiones/accessTokens ya existentes con
 * destroySessionsForUser, dejada preparada para esto — mismo criterio que
 * resetEmployeePassword/changePassword tras rotar una credencial: no dejar
 * filas vivas que ya no deberían servir para nada. Idempotente: desactivar
 * una cuenta ya inactiva no falla, solo repite la operación.
 */
export async function deactivateEmployee(ctx: MutationCtx, args: { userId: Id<"users"> }): Promise<void> {
  const user = await findEmployeeOrFail(ctx, args.userId);
  await ctx.db.patch(user._id, { status: "inactive" });
  await destroySessionsForUser(ctx, user._id);
}

/**
 * Reactivación de empleado (PRO-47): reutiliza la misma cuenta, solo status
 * -> "active". No toca sesiones: una cuenta inactiva no puede tener
 * sesiones vivas (login/loginWithGoogleEmail las rechazan), así que no hay
 * nada que limpiar ni crear aquí — el empleado inicia sesión de nuevo por
 * su cuenta tras reactivarse.
 */
export async function reactivateEmployee(ctx: MutationCtx, args: { userId: Id<"users"> }): Promise<void> {
  const user = await findEmployeeOrFail(ctx, args.userId);
  await ctx.db.patch(user._id, { status: "active" });
}

export type ChangeEmployeeRoleErrorCode = "USER_NOT_FOUND" | "CANNOT_CHANGE_OWN_ROLE" | "CANNOT_REMOVE_LAST_OWNER";

/**
 * Cambia el rol de una cuenta (PRO-56). A diferencia de
 * deactivateEmployee/reactivateEmployee (restringidas a cuentas ya
 * "employee" vía findEmployeeOrFail), esta función no exige un rol de
 * partida concreto: la regla real no es "solo se puede tocar a un
 * empleado", es "nunca puede quedar el negocio sin ninguna cuenta Dueña".
 * Hoy la única pantalla que la llama (Gestión de empleados) solo lista
 * empleados, así que en la práctica solo asciende — pero la comprobación
 * cubre también la degradación por si un futuro caller (p. ej. PRO-51) la
 * dispara.
 *
 * Dos invariantes, independientes entre sí:
 * 1. Nadie puede cambiar su propio rol (CANNOT_CHANGE_OWN_ROLE),
 *    incondicionalmente — ni siquiera si hay otra cuenta Dueña de sobra.
 *    Evita que la Dueña se quite a sí misma el acceso de administración por
 *    error, incluso en un negocio con varias Dueñas; ver args.callerId, que
 *    el caller (mutation pública) rellena con el usuario ya autenticado por
 *    requireOwner, nunca con un valor que el cliente pueda manipular.
 * 2. Nunca puede quedar el negocio sin ninguna cuenta Dueña
 *    (CANNOT_REMOVE_LAST_OWNER) — cubre también el caso de que otra persona
 *    degrade a la última Dueña restante.
 *
 * Idempotente si el rol destino coincide con el actual: no dispara el
 * conteo de Dueñas porque esa comprobación solo mira transiciones
 * owner -> employee. No hace falta rotar sesiones: a diferencia de un
 * cambio de contraseña, el rol se relee en caliente de la base en cada
 * verifyAccessToken (ver convex/model/sessions.ts), así que el cambio se
 * aplica solo con la siguiente petición del usuario afectado.
 */
export async function changeEmployeeRole(
  ctx: MutationCtx,
  args: { userId: Id<"users">; role: UserRole; callerId: Id<"users"> },
): Promise<void> {
  const user = await ctx.db.get(args.userId);
  if (!user) {
    fail<ChangeEmployeeRoleErrorCode>("USER_NOT_FOUND", "Ese usuario ya no existe.");
  }
  if (user._id === args.callerId) {
    fail<ChangeEmployeeRoleErrorCode>("CANNOT_CHANGE_OWN_ROLE", "No puedes cambiar tu propio rol.");
  }
  if (user.role === "owner" && args.role === "employee") {
    const owners = (await ctx.db.query("users").collect()).filter((u) => u.role === "owner");
    if (owners.length <= 1) {
      fail<ChangeEmployeeRoleErrorCode>("CANNOT_REMOVE_LAST_OWNER", "No puedes quitar el rol de Dueña a la última cuenta que lo tiene.");
    }
  }
  await ctx.db.patch(user._id, { role: args.role });
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

export type ResetPasswordAfterVerificationErrorCode = "RESET_CODE_INVALID" | "PASSWORD_REQUIRED" | "PASSWORD_TOO_SHORT" | "PASSWORD_TOO_LONG";

/**
 * Restablecimiento por código de email (PRO-68) — a diferencia de
 * changePassword (exige sesión + contraseña actual) y resetEmployeePassword
 * (lo hace la Dueña sobre otra cuenta), aquí "conocía el código del email"
 * hace de credencial: el caller ya resolvió y validó el código de
 * restablecimiento (ver convex/model/passwordReset.ts) antes de llamar
 * aquí. No auto-inicia sesión (a diferencia de changePassword): tras
 * restablecer por email, el usuario entra por /login con la contraseña
 * nueva — no se crea una sesión a partir de una prueba más débil (posesión
 * del email) que un login real.
 */
export async function resetPasswordAfterVerification(ctx: MutationCtx, args: { userId: Id<"users">; newPassword: string }): Promise<void> {
  const user = await ctx.db.get(args.userId);
  // Defensivo: hoy no existe borrado físico de usuarios (solo status
  // "inactive"), así que esto no debería poder pasar; se mantiene el mismo
  // código genérico por si acaso, en vez de asumir que ctx.db.get siempre acierta.
  if (!user) {
    fail<ResetPasswordAfterVerificationErrorCode>("RESET_CODE_INVALID", "Código incorrecto o caducado.");
  }
  validateNewPassword(args.newPassword);
  await ctx.db.patch(user._id, {
    passwordHash: hashSync(args.newPassword, PASSWORD_HASH_COST),
    mustChangePassword: false,
  });
  await destroySessionsForUser(ctx, user._id);
}
