import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { login as loginModel, verifySession as verifySessionModel, destroySession as destroySessionModel } from "./model/sessions";

const roleValidator = v.union(v.literal("owner"), v.literal("employee"));

/**
 * Mutations/queries públicas a propósito: un login no puede exigir estar ya
 * autenticado. Ninguno de los DTOs de retorno incluye `passwordHash`.
 */
export const login = mutation({
  args: { email: v.string(), password: v.string() },
  returns: v.object({
    token: v.string(),
    name: v.string(),
    role: roleValidator,
    mustChangePassword: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const result = await loginModel(ctx, args);
    return { token: result.token, name: result.name, role: result.role, mustChangePassword: result.mustChangePassword };
  },
});

export const verify = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      name: v.string(),
      email: v.string(),
      role: roleValidator,
      mustChangePassword: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => verifySessionModel(ctx, args.token),
});

export const logout = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await destroySessionModel(ctx, args.token);
    return null;
  },
});
