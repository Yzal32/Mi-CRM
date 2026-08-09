import type { MutationCtx, QueryCtx } from "../_generated/server";

export type Actor = { id: string; name: string };

const DEMO_ACTOR: Actor = { id: "stub-marta", name: "Marta" };

/**
 * Identidad fija de servidor. Ya existe login real (PRO-44: cookie de
 * sesión httpOnly + convex/model/sessions.ts), pero migrar la atribución
 * de autoría de notas/ventas/seguimientos al usuario real que ha iniciado
 * sesión queda deliberadamente para una tarea aparte (decisión tomada al
 * implementar PRO-44) — cambiaría la firma de mutations públicas ya en
 * producción (notes.create, followUps.upsert) y los componentes que las
 * llaman, más allá del alcance de "Inicio de sesión" en sí.
 *
 * A diferencia de lib/auth/currentUser.ts (solo presentación en Next.js),
 * este es el valor que Convex realmente persiste como autor/responsable —
 * las mutations públicas de notas/ventas/seguimientos NUNCA aceptan
 * authorId/authorName ni assigneeId/assigneeName como argumento del
 * cliente, siempre llaman a getActor(ctx) en servidor.
 *
 * Importante: esto NO es autenticación. Toda nota/venta/seguimiento queda
 * atribuida a esta identidad fija sea quien sea quien la creó de verdad —
 * no impide la atribución, impide que se pueda elegir otra. Admisible solo
 * mientras el deployment contenga datos ficticios (ver seed.ts) — mismo
 * riesgo que documenta README.md para las mutations públicas sin sesión.
 *
 * Ya es async y recibe `ctx` para que la futura migración (leer la sesión
 * real vía un argumento de token, no ctx.auth — no hay proveedor de
 * identidad configurado en Convex, ver el plan de PRO-44) no obligue a
 * cambiar la forma de los call sites — solo la implementación de esta
 * función.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ver docstring: `ctx` se queda sin usar hasta que se migre la atribución real de autoría
export async function getActor(_ctx: QueryCtx | MutationCtx): Promise<Actor> {
  return DEMO_ACTOR;
}
