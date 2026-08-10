import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getActor } from "./model/actor";
import { createNote, unfeatureNote } from "./model/notes";
import { requireAccessToken } from "./model/auth";

const LIST_LIMIT = 500;
// +2 de margen sobre LIST_LIMIT: una destacada dentro de la ventana ocupa
// uno de los huecos deseados de notas normales; con solo +1 el caso límite
// de exactamente 500/501 notas normales combinado con una destacada dentro
// de la ventana puede ocultar una nota normal de más sin marcar `truncated`.
// Ver convex/notes.test.ts para los casos límite verificados a mano.
const RAW_FETCH_LIMIT = LIST_LIMIT + 2;

const noteDto = v.object({
  _id: v.id("notes"),
  _creationTime: v.number(),
  clientId: v.id("clients"),
  date: v.string(),
  text: v.string(),
  featured: v.boolean(),
  authorId: v.string(),
  authorName: v.string(),
});

// DTO construido listando explícitamente los campos públicos (no
// desestructurando para omitir seedData/seedKey) — evita avisos de lint por
// variables no usadas y documenta mejor el contrato público.
function toNoteDto(note: Doc<"notes">) {
  return {
    _id: note._id,
    _creationTime: note._creationTime,
    clientId: note.clientId,
    date: note.date,
    text: note.text,
    featured: note.featured,
    authorId: note.authorId,
    authorName: note.authorName,
  };
}

export const listByClient = query({
  args: { token: v.string(), clientId: v.id("clients") },
  returns: v.object({
    featured: v.union(noteDto, v.null()),
    items: v.array(noteDto),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAccessToken(ctx, args.token);
    // La destacada se resuelve aparte del listado paginado: si el cliente
    // tiene más de 500 notas y la destacada es antigua, `items` no la
    // traería — pero debe seguir siempre visible en la ficha.
    const featuredRows = await ctx.db
      .query("notes")
      .withIndex("by_client_featured", (q) => q.eq("clientId", args.clientId).eq("featured", true))
      .collect();
    const featured = featuredRows[0] ?? null;

    const raw = await ctx.db
      .query("notes")
      .withIndex("by_client_date", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(RAW_FETCH_LIMIT);
    // Se excluye por el campo `featured`, no comparando el id de la
    // destacada resuelta arriba — cubre también el caso defensivo de que
    // hubiera más de una marcada a la vez.
    const nonFeatured = raw.filter((n) => !n.featured);
    const truncated = nonFeatured.length > LIST_LIMIT;
    const items = nonFeatured.slice(0, LIST_LIMIT).map(toNoteDto);

    return { featured: featured ? toNoteDto(featured) : null, items, truncated };
  },
});

// Nunca acepta authorId/authorName del cliente: el servidor asigna siempre
// la identidad de demostración (ver convex/model/actor.ts) para que nadie
// pueda firmar una nota como otra persona llamando a la mutation a mano.
export const create = mutation({
  args: {
    token: v.string(),
    clientId: v.id("clients"),
    text: v.string(),
    featured: v.optional(v.boolean()),
    expectedFeaturedNoteId: v.optional(v.union(v.id("notes"), v.null())),
  },
  returns: v.id("notes"),
  handler: async (ctx, args) => {
    await requireAccessToken(ctx, args.token);
    const actor = await getActor(ctx);
    return createNote(ctx, { ...args, authorId: actor.id, authorName: actor.name });
  },
});

export const unfeature = mutation({
  args: { token: v.string(), noteId: v.id("notes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAccessToken(ctx, args.token);
    await unfeatureNote(ctx, args);
    return null;
  },
});
