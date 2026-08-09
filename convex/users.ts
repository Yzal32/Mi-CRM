import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { createUser } from "./model/users";

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
