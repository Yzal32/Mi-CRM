import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import {
  changePassword as changePasswordModel,
  createUser,
  resetEmployeePassword as resetEmployeePasswordModel,
  updateUserEmail as updateUserEmailModel,
} from "./model/users";
import { requireOwner } from "./model/auth";

/**
 * internalMutation: SOLO invocable por CLI (`npx convex run
 * users:provisionUser '{"name":...,"email":...,"password":...,"role":"owner"|"employee"}'`)
 * o desde otra función de servidor — igual que convex/seed.ts (seed/clearSeed).
 * Nunca en la superficie pública sin autenticación (ver README.md): el
 * navegador no puede llamar a una internalMutation.
 *
 * Es la forma en que PRO-43 cumple su propia regla de negocio ("la cuenta de
 * la Dueña y la del primer empleado se crean directamente al desplegar, no
 * hay pantalla de registro público") sin construir todavía la mutation
 * pública de alta que le corresponde a PRO-45.
 *
 * Riesgo operativo aceptado: la contraseña viaja como argumento posicional
 * de `npx convex run` y queda en el historial de shell local — ver
 * README.md, sección "Desarrollo".
 *
 * mustChangePassword siempre true: una contraseña elegida por quien ejecuta
 * el aprovisionamiento (no por el propio usuario) debe forzarse a cambiar en
 * el próximo acceso, mismo criterio que el reseteo de contraseña de PRO-45.
 * El login (PRO-44) es quien consume este flag.
 */
export const provisionUser = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    role: v.union(v.literal("owner"), v.literal("employee")),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => createUser(ctx, { ...args, mustChangePassword: true }),
});

/**
 * Mutation pública — requiere una sesión válida (`token`), no expone nada
 * que un usuario ya autenticado no pudiera pedir sobre sí mismo. Cubre
 * tanto el cambio obligatorio (mustChangePassword: true, tras
 * provisionUser) como el voluntario desde Ajustes (PRO-57) — la propia
 * mutation no distingue los dos casos, ambos son "cambiar mi contraseña
 * conociendo la actual". Devuelve un token de sesión nuevo (rotación, ver
 * convex/model/users.ts): el caller (Server Action) debe sustituir la
 * cookie del navegador por él.
 */
export const changePassword = mutation({
  args: {
    token: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args) => changePasswordModel(ctx, args),
});

/**
 * Alta de empleado (PRO-45) — mutation pública, solo la Dueña. role y
 * mustChangePassword nunca llegan como argumento del cliente: se fijan aquí
 * a "employee"/true, mismo criterio que provisionUser (una contraseña
 * elegida por otra persona, no por el propio usuario, siempre fuerza el
 * cambio en el próximo acceso).
 */
export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    email: v.string(),
    password: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.token);
    return createUser(ctx, {
      name: args.name,
      email: args.email,
      password: args.password,
      role: "employee",
      mustChangePassword: true,
    });
  },
});

/**
 * Reseteo de contraseña de un empleado ya existente (PRO-45), solo la
 * Dueña — a diferencia de `changePassword`, no exige la contraseña actual
 * (Marta no la conoce). Devuelve la contraseña temporal en claro, para
 * mostrarla una única vez a la Dueña (ver convex/model/users.ts).
 */
export const resetEmployeePassword = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
  },
  returns: v.object({ temporaryPassword: v.string() }),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.token);
    return resetEmployeePasswordModel(ctx, { userId: args.userId });
  },
});

/**
 * internalMutation: vía administrativa genérica para corregir el email de
 * un usuario ya existente — igual que provisionUser, solo por CLI (`npx
 * convex run users:updateEmail '{"userId":...,"email":...}'`) o desde otra
 * función de servidor. No existe ninguna pantalla que la exponga.
 */
export const updateEmail = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await updateUserEmailModel(ctx, args);
    return null;
  },
});
