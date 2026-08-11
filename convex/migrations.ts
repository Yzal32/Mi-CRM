import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { foldDiacritics } from "../lib/shared/foldDiacritics";

/**
 * internalMutation: SOLO invocable por CLI (`npx convex run
 * migrations:backfillClientsNameFold`) o desde otra función de servidor —
 * mismo criterio que users:provisionUser.
 *
 * Rellena `nameFold` en los clientes creados antes de que este campo
 * existiera (createClient/updateClient ya lo mantienen para cualquier
 * escritura nueva o editada, ver convex/model/clients.ts). Sin este
 * backfill, un cliente antiguo cuyo nombre no se haya vuelto a editar no
 * aparecería en el buscador de nombre en absoluto (el índice de texto vive
 * sobre `nameFold`, no sobre `name`).
 *
 * .collect() es aceptable aquí: es una migración de un solo uso sobre el
 * conjunto completo de clientes, no una consulta que se repite en cada
 * tecleo del buscador (eso sí necesita estar acotado, ver clients.search).
 * Idempotente: solo escribe si el valor calculado difiere del guardado, así
 * que se puede volver a ejecutar sin efecto si algo se interrumpe a medias.
 */
export const backfillClientsNameFold = internalMutation({
  args: {},
  returns: v.object({ total: v.number(), updated: v.number() }),
  handler: async (ctx) => {
    const clients = await ctx.db.query("clients").collect();
    let updated = 0;
    for (const client of clients) {
      const nameFold = foldDiacritics(client.name);
      if (client.nameFold !== nameFold) {
        await ctx.db.patch(client._id, { nameFold });
        updated++;
      }
    }
    return { total: clients.length, updated };
  },
});
