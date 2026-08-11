import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { createClient, updateClient, updateClientStatus } from "./model/clients";
import { requireAccessToken } from "./model/auth";
import { foldDiacritics } from "../lib/shared/foldDiacritics";
import { phoneSearchDigits } from "../lib/shared/normalizePhoneKey";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

const originChannelValidator = v.union(
  v.literal("web"),
  v.literal("social"),
  v.literal("email"),
  v.literal("whatsapp"),
  v.literal("referral"),
  v.literal("visit"),
);

const statusValidator = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("interested"),
  v.literal("won"),
  v.literal("lost"),
);

const clientDto = v.object({
  _id: v.id("clients"),
  _creationTime: v.number(),
  name: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  originChannel: v.optional(originChannelValidator),
  status: v.optional(statusValidator),
  signupDate: v.optional(v.string()),
});

// PRO-59: exige un accessToken vigente (ver convex/model/auth.ts) — ya no
// alcanzable "gratis" con solo la URL del deployment, ver README.md.
export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    originChannel: v.optional(originChannelValidator),
    status: v.optional(statusValidator),
  },
  returns: v.id("clients"),
  handler: async (ctx, args) => {
    await requireAccessToken(ctx, args.token);
    return createClient(ctx, args);
  },
});

// clientId llega como string plano (la ruta de Next.js entrega un string,
// no un Id<"clients">): normalizeId devuelve null tanto si el string tiene
// un formato inválido como si no corresponde a ningún documento — en
// ambos casos se trata igual, como "cliente no encontrado", sin reventar
// el validador de un v.id("clients") con un ID malformado.
export const getById = query({
  args: { token: v.string(), clientId: v.string() },
  returns: v.union(clientDto, v.null()),
  handler: async (ctx, args) => {
    await requireAccessToken(ctx, args.token);
    const id = ctx.db.normalizeId("clients", args.clientId);
    if (!id) return null;
    const client = await ctx.db.get(id);
    if (!client) return null;
    return {
      _id: client._id,
      _creationTime: client._creationTime,
      name: client.name,
      phone: client.phone,
      email: client.email,
      originChannel: client.originChannel,
      status: client.status,
      signupDate: client.signupDate,
    };
  },
});

export const updateStatus = mutation({
  args: { token: v.string(), clientId: v.id("clients"), status: statusValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAccessToken(ctx, args.token);
    await updateClientStatus(ctx, args);
    return null;
  },
});

// `name` es v.optional aquí (a diferencia de `create`, donde es
// obligatorio): en la edición, "no enviarlo" es una opción legítima que
// significa "no tocar este campo", no un olvido.
export const update = mutation({
  args: {
    token: v.string(),
    clientId: v.id("clients"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    originChannel: v.optional(originChannelValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAccessToken(ctx, args.token);
    await updateClient(ctx, args);
    return null;
  },
});

export const LIST_LIMIT = 300;

const clientSearchItem = v.object({
  clientId: v.id("clients"),
  name: v.string(),
  phone: v.optional(v.string()),
  status: v.optional(statusValidator),
});

// Trunca por PUNTOS DE CÓDIGO, no por unidades UTF-16: `for...of` sobre un
// string itera por code point, tratando un par subrogado (p. ej. un
// emoji) como una sola unidad — a diferencia de `.length`/`.slice()`, que
// operan en UTF-16 y pueden partir un par subrogado por la mitad, dejando
// una cadena con un surrogate suelto (UTF-16 inválido; Convex exige
// cadenas UTF-8 válidas). Exportada (junto a sanitizeNameQuery y
// truncateCodePoints, más abajo) para poder testearla como unidad pura,
// sin pasar por convexTest.
export function truncateUtf8Bytes(value: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  let result = "";
  let bytes = 0;
  for (const char of value) {
    const charBytes = encoder.encode(char).length;
    if (bytes + charBytes > maxBytes) break;
    result += char;
    bytes += charBytes;
  }
  return result;
}

// Convex/Tantivy tokeniza por cualquier separador de palabra, no solo por
// espacios en blanco — la puntuación también separa términos. Dividir solo
// por /\s+/ infracontaría términos frente al índice real ante una entrada
// como "a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q" (17 "palabras" para Convex,
// pese a no tener ningún espacio: el límite de 16 términos por consulta se
// supera y Convex puede rechazar la consulta en runtime). Alcanzable desde
// el propio SearchBar (cabe de sobra en el tope de 100 caracteres), no
// solo invocando la API directamente. Se extraen directamente las tiras de
// letras/dígitos Unicode (\p{L}\p{N}) como "palabras": una aproximación
// deliberadamente más agresiva que la tokenización real, así que nunca
// cuenta MENOS términos de los que vería Convex — nunca deja pasar una
// consulta que Convex fuera a rechazar por exceso de términos.
//
// Aproximación deliberadamente imperfecta, documentada: Tantivy (el motor
// de texto de Convex) separa por `char::is_alphanumeric()` (Alphabetic ||
// Numeric), no exactamente por las categorías generales Unicode Letter/
// Number usadas aquí — p. ej. U+0345 es Alphabetic pero no \p{L}/\p{N}, así
// que Tantivy lo mantendría pegado a la palabra y este sanitizador lo
// separaría en un término aparte. No afecta al español (nombres/teléfonos
// no usan marcas combinantes de ese tipo) ni a la protección del límite de
// 16 términos (separar de más nunca hace que se acepte una consulta que
// Convex fuera a rechazar); si el negocio llegara a operar con nombres de
// alfabetos que sí las usan, revisar esta aproximación.
export function sanitizeNameQuery(raw: string): string {
  const words = raw.match(/[\p{L}\p{N}]+/gu) ?? [];
  return words
    .slice(0, 16)
    .map((word) => truncateUtf8Bytes(word, 32))
    .join(" ");
}

// Recorta por PUNTOS DE CÓDIGO (Array.from itera por code point, no por
// unidad UTF-16) — un slice(0, 100) directo sobre el string podría partir
// un par subrogado justo en la posición 100 y dejar una cadena con un
// surrogate suelto (UTF-16 inválido). Exportada aparte del handler para
// poder testearla directamente.
export function truncateCodePoints(value: string, maxCodePoints: number): string {
  return Array.from(value).slice(0, maxCodePoints).join("");
}

async function searchByPhonePrefix(ctx: QueryCtx, phoneTerm: string, limit: number): Promise<Doc<"clients">[]> {
  return ctx.db
    .query("clients")
    .withIndex("by_phoneKey", (q) => q.gte("phoneKey", phoneTerm).lt("phoneKey", `${phoneTerm}￿`))
    .take(limit);
}

// PRO-10: buscador de clientes por nombre o teléfono, en vivo. Dos índices
// de naturaleza distinta, nunca un escaneo: `by_phoneKey` (regular, rango
// por prefijo, determinista) para teléfono; `search_name` (texto, por
// relevancia) para nombre — evita que coincidencias de nombre "ruidosas"
// expulsen una coincidencia de teléfono exacta al fusionar. El teléfono
// entra siempre primero en la fusión, así que nunca puede perderse en el
// corte de LIST_LIMIT mientras haya hueco. Empareja por PREFIJO de palabra
// o de número, no por subcadena en cualquier posición (decisión de
// producto: es lo que un índice real de Convex puede ofrecer sin escanear
// la tabla completa).
export const search = query({
  args: { token: v.string(), search: v.string() },
  returns: v.object({ items: v.array(clientSearchItem), truncated: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAccessToken(ctx, args.token);
    const bounded = truncateCodePoints(args.search.trim(), 100);
    // No consulta `clients` (requireAccessToken sí toca la base de datos,
    // para verificar el token, antes de llegar aquí).
    if (!bounded) return { items: [], truncated: false };

    // Teléfono: consulta de RANGO por prefijo sobre el índice regular
    // by_phoneKey ya existente (no un índice de texto) — determinista, sin
    // ranking por relevancia, coste proporcional a las coincidencias reales.
    // "￿" (el mayor code point del BMP) como cota superior exclusiva
    // es la forma estándar de expresar "empieza por" con un índice de
    // rango normal en Convex, dado que phoneKey son siempre dígitos ASCII,
    // muy por debajo de "￿" en orden lexicográfico.
    const phoneTerm = phoneSearchDigits(bounded);
    const phoneMatches = phoneTerm ? await searchByPhonePrefix(ctx, phoneTerm, LIST_LIMIT + 1) : [];

    // Nombre: índice de texto sobre `nameFold` (no `name`), coincidencia por
    // relevancia. El propio término se pliega igual (foldDiacritics) antes
    // de sanitizarlo — así "maria" y "María" buscan y encuentran lo mismo,
    // confirmado que el índice de texto de Convex NO pliega diacríticos por
    // sí solo (solo casefolding) al probarlo contra un deployment real.
    const nameQuery = sanitizeNameQuery(foldDiacritics(bounded));
    const nameMatches = nameQuery
      ? await ctx.db
          .query("clients")
          .withSearchIndex("search_name", (q) => q.search("nameFold", nameQuery))
          .take(LIST_LIMIT + 1)
      : [];

    // El teléfono es autoritativo: una coincidencia de prefijo sobre
    // phoneKey es exacta y determinista, así que SIEMPRE entra primero en
    // la fusión y nunca puede quedar fuera del corte por "ruido" del
    // índice de texto de nombre (que sí devuelve resultados por
    // relevancia, sin ninguna garantía de orden útil para esta prioridad).
    // Los huecos restantes hasta LIST_LIMIT los rellenan las coincidencias
    // de nombre.
    const merged = new Map<string, Doc<"clients">>();
    for (const client of phoneMatches) merged.set(client._id, client);
    for (const client of nameMatches) merged.set(client._id, client);
    const rows = [...merged.values()];

    return {
      items: rows
        .slice(0, LIST_LIMIT)
        .map((client) => ({ clientId: client._id, name: client.name, phone: client.phone, status: client.status })),
      truncated: rows.length > LIST_LIMIT,
    };
  },
});
