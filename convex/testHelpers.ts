import type { TestConvex } from "convex-test";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { createUser, type UserRole } from "./model/users";

const EMAIL = "auth-helper@ejemplo.com";
const PASSWORD = "contraseña-valida";

/**
 * Crea un usuario activo, inicia sesión y emite un accessToken — usado por
 * los tests de convex/clients.ts, notes.ts, followUps.ts, sales.ts y
 * users.ts (PRO-59/PRO-45: las 16 funciones públicas de negocio ahora
 * exigen `token`). Cada test tiene su propia instancia de `t` (convexTest,
 * base de datos aislada), así que crear un usuario con el mismo email en
 * cada llamada nunca choca contra DUPLICATE_EMAIL entre tests distintos.
 * `role` por defecto "owner" (todas las llamadas existentes antes de
 * PRO-45 lo asumían así); pasar "employee" para probar guards como
 * requireOwner.
 */
export async function issueTestActor(
  t: TestConvex<typeof schema>,
  role: UserRole = "owner",
): Promise<{ accessToken: string; userId: Id<"users"> }> {
  const userId = await t.run((ctx) =>
    createUser(ctx, {
      name: "Usuario de prueba",
      email: EMAIL,
      password: PASSWORD,
      role,
      mustChangePassword: false,
    }),
  );
  const { token: sessionToken } = await t.mutation(api.sessions.login, { email: EMAIL, password: PASSWORD });
  const { accessToken } = await t.mutation(api.sessions.issueAccessToken, { token: sessionToken });
  return { accessToken, userId };
}

export async function issueTestAccessToken(t: TestConvex<typeof schema>, role: UserRole = "owner"): Promise<string> {
  return (await issueTestActor(t, role)).accessToken;
}
