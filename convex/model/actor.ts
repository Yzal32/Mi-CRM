import type { MutationCtx, QueryCtx } from "../_generated/server";

export type Actor = { id: string; name: string };

const DEMO_ACTOR: Actor = { id: "stub-marta", name: "Marta" };

/**
 * Identidad fija de servidor mientras no exista login real (PRO-44). A
 * diferencia de lib/auth/currentUser.ts (solo presentación en Next.js),
 * este es el valor que Convex realmente persiste como autor/responsable —
 * las mutations públicas de notas/ventas/seguimientos NUNCA aceptan
 * authorId/authorName ni assigneeId/assigneeName como argumento del
 * cliente, siempre llaman a getActor(ctx) en servidor.
 *
 * Importante: esto NO es autenticación. Toda nota/venta/seguimiento queda
 * atribuida a esta identidad fija sea quien sea quien la creó de verdad —
 * no impide la atribución, impide que se pueda elegir otra. Admisible solo
 * mientras el deployment contenga datos ficticios (ver seed.ts).
 *
 * Ya es async y recibe `ctx` para que introducir ctx.auth.getUserIdentity()
 * más adelante no obligue a cambiar la forma de los call sites — solo la
 * implementación de esta función.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ver docstring: `ctx` se queda sin usar hasta que exista login real
export async function getActor(_ctx: QueryCtx | MutationCtx): Promise<Actor> {
  return DEMO_ACTOR;
}
