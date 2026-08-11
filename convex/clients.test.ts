import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { LIST_LIMIT, sanitizeNameQuery, truncateCodePoints, truncateUtf8Bytes } from "./clients";
import { issueTestAccessToken } from "./testHelpers";
import { foldDiacritics } from "../lib/shared/foldDiacritics";

const modules = import.meta.glob("./**/*.ts");

describe("clients.create", () => {
  test("crea un cliente y devuelve su id", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.name).toBe("Carlos Ruiz");
    expect(doc?.status).toBe("new");
  });

  test("rechaza sin nombre, exponiendo el código en error.data.code", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);

    let caught: unknown;
    try {
      await t.mutation(api.clients.create, { token, name: "", phone: "622334556" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConvexError);
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("NAME_REQUIRED");
  });

  test("rechaza sin token válido con UNAUTHENTICATED", async () => {
    const t = convexTest(schema, modules);

    let caught: unknown;
    try {
      await t.mutation(api.clients.create, { token: "a".repeat(64), name: "Carlos Ruiz", phone: "622334556" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConvexError);
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("UNAUTHENTICATED");
  });
});

describe("clients.getById", () => {
  test("devuelve el cliente por un id válido", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    const result = await t.query(api.clients.getById, { token, clientId: id });
    expect(result?.name).toBe("Carlos Ruiz");
  });

  test("devuelve null con un ID malformado, sin reventar el validador", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await expect(t.query(api.clients.getById, { token, clientId: "no-es-un-id-valido" })).resolves.toBeNull();
  });

  test("devuelve null con un ID válido pero de un cliente borrado", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });
    await t.run((ctx) => ctx.db.delete(id));

    expect(await t.query(api.clients.getById, { token, clientId: id })).toBeNull();
  });

  test("el DTO no expone phoneKey, seedData ni seedKey", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    const result = await t.query(api.clients.getById, { token, clientId: id });
    expect(result).not.toHaveProperty("phoneKey");
    expect(result).not.toHaveProperty("seedData");
    expect(result).not.toHaveProperty("seedKey");
  });
});

describe("clients.updateStatus", () => {
  test("cambia el estado del cliente", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    await t.mutation(api.clients.updateStatus, { token, clientId: id, status: "won" });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.status).toBe("won");
  });

  test("CLIENT_NOT_FOUND con un cliente borrado", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });
    await t.run((ctx) => ctx.db.delete(id));

    let caught: unknown;
    try {
      await t.mutation(api.clients.updateStatus, { token, clientId: id, status: "won" });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("CLIENT_NOT_FOUND");
  });
});

describe("clients.update", () => {
  test("UNAUTHENTICATED no deja escritura parcial: el documento queda intacto", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });
    const before = await t.run((ctx) => ctx.db.get(id));

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { token: "a".repeat(64), clientId: id, name: "Nombre Colado" });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("UNAUTHENTICATED");

    const after = await t.run((ctx) => ctx.db.get(id));
    expect(after).toEqual(before);
  });

  test("caso feliz: actualiza nombre, teléfono, email y canal de origen", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    await t.mutation(api.clients.update, {
      token,
      clientId: id,
      name: "Carlos R.",
      phone: "699111222",
      email: "carlos@ejemplo.com",
      originChannel: "referral",
    });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.name).toBe("Carlos R.");
    expect(doc?.phone).toBe("699111222");
    expect(doc?.email).toBe("carlos@ejemplo.com");
    expect(doc?.originChannel).toBe("referral");
  });

  test("CLIENT_NOT_FOUND con un cliente borrado", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });
    await t.run((ctx) => ctx.db.delete(id));

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { token, clientId: id, name: "Carlos Ruiz" });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("CLIENT_NOT_FOUND");
  });

  test("NAME_REQUIRED si se envía un nombre vacío", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { token, clientId: id, name: "   " });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("NAME_REQUIRED");
  });

  test("NAME_TOO_LONG si el nombre supera el máximo", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { token, clientId: id, name: "a".repeat(201) });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("NAME_TOO_LONG");
  });

  test("INVALID_PHONE si el teléfono enviado no es válido", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { token, clientId: id, phone: "abc" });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("INVALID_PHONE");
  });

  test("INVALID_EMAIL si el email enviado no es válido", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { token, clientId: id, email: "no-valido" });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("INVALID_EMAIL");
  });

  test("DUPLICATE_PHONE si el teléfono ya lo usa otro cliente", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.mutation(api.clients.create, { token, name: "Ana", phone: "600111222" });
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { token, clientId: id, phone: "600111222" });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("DUPLICATE_PHONE");
  });

  test("guardar el mismo teléfono reescrito con otro formato no choca contra sí mismo", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622 33 45 56" });

    await t.mutation(api.clients.update, { token, clientId: id, phone: "622334556" });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.phone).toBe("622334556");
  });

  test("omitir name conserva el nombre existente", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    await t.mutation(api.clients.update, { token, clientId: id, phone: "699111222" });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.name).toBe("Carlos Ruiz");
    expect(doc?.phone).toBe("699111222");
  });

  test("omitir phone/email/originChannel conserva sus valores existentes", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, {
      token,
      name: "Carlos Ruiz",
      phone: "622334556",
      email: "carlos@ejemplo.com",
      originChannel: "referral",
    });

    await t.mutation(api.clients.update, { token, clientId: id, name: "Carlos R." });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.name).toBe("Carlos R.");
    expect(doc?.phone).toBe("622334556");
    expect(doc?.email).toBe("carlos@ejemplo.com");
    expect(doc?.originChannel).toBe("referral");
  });

  test("omitir originChannel en un cliente con canal distinto de web lo conserva (no cae al default)", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, {
      token,
      name: "Carlos Ruiz",
      phone: "622334556",
      originChannel: "whatsapp",
    });

    await t.mutation(api.clients.update, { token, clientId: id, name: "Carlos R." });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.originChannel).toBe("whatsapp");
  });

  test("omitir los 4 campos a la vez no falla y no cambia nada (patch vacío)", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    await t.mutation(api.clients.update, { token, clientId: id });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.name).toBe("Carlos Ruiz");
    expect(doc?.phone).toBe("622334556");
  });

  test("borrar el teléfono con email presente elimina phoneKey", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, {
      token,
      name: "Carlos Ruiz",
      phone: "622334556",
      email: "carlos@ejemplo.com",
    });

    await t.mutation(api.clients.update, { token, clientId: id, phone: "" });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.phone).toBeUndefined();
    expect(doc?.phoneKey).toBeUndefined();
    expect(doc?.email).toBe("carlos@ejemplo.com");
  });

  test("el teléfono liberado por un borrado se puede reutilizar en otro cliente", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, {
      token,
      name: "Carlos Ruiz",
      phone: "622334556",
      email: "carlos@ejemplo.com",
    });
    await t.mutation(api.clients.update, { token, clientId: id, phone: "" });

    const otherId = await t.mutation(api.clients.create, { token, name: "Ana", phone: "622334556" });

    const other = await t.run((ctx) => ctx.db.get(otherId));
    expect(other?.phone).toBe("622334556");
  });

  test("borrar teléfono y email a la vez rechaza con CONTACT_REQUIRED", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, {
      token,
      name: "Carlos Ruiz",
      phone: "622334556",
      email: "carlos@ejemplo.com",
    });

    let caught: unknown;
    try {
      await t.mutation(api.clients.update, { token, clientId: id, phone: "", email: "" });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("CONTACT_REQUIRED");
  });
});

describe("clients.search", () => {
  test("encuentra por prefijo de una palabra del nombre, insensible a mayúsculas", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });
    await t.mutation(api.clients.create, { token, name: "Ana Torres", phone: "611220987" });

    const result = await t.query(api.clients.search, { token, search: "car" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Carlos Ruiz");
    expect(result.truncated).toBe(false);
  });

  test("encuentra por prefijo de una palabra del nombre que no es la primera", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    const result = await t.query(api.clients.search, { token, search: "ruiz" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Carlos Ruiz");
  });

  test("no encuentra por una subcadena que no sea prefijo de ninguna palabra", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    const result = await t.query(api.clients.search, { token, search: "arlos" });
    expect(result.items).toEqual([]);
  });

  test("encuentra por nombre con tilde buscando sin tilde (plegado de acentos)", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.mutation(api.clients.create, { token, name: "María López", phone: "622334556" });

    const result = await t.query(api.clients.search, { token, search: "maria" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("María López");
  });

  test("encuentra por nombre sin tilde buscando con tilde/eñe y en mayúsculas (plegado simétrico)", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.mutation(api.clients.create, { token, name: "Nunez Sin Tilde", phone: "622334556" });

    const result = await t.query(api.clients.search, { token, search: "ÑÚÑEZ" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Nunez Sin Tilde");
  });

  test("editar el nombre actualiza nameFold: ya no se encuentra por el nombre antiguo, sí por el nuevo", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    const id = await t.mutation(api.clients.create, { token, name: "Andres Sinacento", phone: "622334556" });

    await t.mutation(api.clients.update, { token, clientId: id, name: "Verónica Nueva" });

    const oldName = await t.query(api.clients.search, { token, search: "andres" });
    expect(oldName.items).toEqual([]);

    const newName = await t.query(api.clients.search, { token, search: "veronica" });
    expect(newName.items).toHaveLength(1);
    expect(newName.items[0].name).toBe("Verónica Nueva");
  });

  test("encuentra por prefijo del teléfono", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    const result = await t.query(api.clients.search, { token, search: "622" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Carlos Ruiz");
  });

  test("no encuentra por una subcadena de teléfono que no sea prefijo", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    const result = await t.query(api.clients.search, { token, search: "4556" });
    expect(result.items).toEqual([]);
  });

  test("encuentra por teléfono escrito con espacios/guiones", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622 33 45 56" });

    const result = await t.query(api.clients.search, { token, search: "622-33-45" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Carlos Ruiz");
  });

  test("encuentra por teléfono buscando el valor mostrado con prefijo +34, contra un phoneKey sin prefijo", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "+34 622 334 556" });

    const result = await t.query(api.clients.search, { token, search: "+34 622 334 556" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Carlos Ruiz");
  });

  test("un cliente sin teléfono no aparece en una búsqueda numérica", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.mutation(api.clients.create, { token, name: "Sin Teléfono", email: "sin@ejemplo.com" });

    const result = await t.query(api.clients.search, { token, search: "622" });
    expect(result.items).toEqual([]);
  });

  test("sin coincidencias devuelve lista vacía sin truncar", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    const result = await t.query(api.clients.search, { token, search: "inexistente" });
    expect(result.items).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  test("un término vacío o solo espacios no revienta y devuelve lista vacía (defensivo)", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.mutation(api.clients.create, { token, name: "Carlos Ruiz", phone: "622334556" });

    const result = await t.query(api.clients.search, { token, search: "   " });
    expect(result.items).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  test("rechaza sin token válido con UNAUTHENTICATED", async () => {
    const t = convexTest(schema, modules);
    let caught: unknown;
    try {
      await t.query(api.clients.search, { token: "a".repeat(64), search: "carlos" });
    } catch (error) {
      caught = error;
    }
    expect((caught as ConvexError<{ code: string }>).data.code).toBe("UNAUTHENTICATED");
  });

  test("una coincidencia de teléfono no se pierde aunque el buscador de nombre esté lleno", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.run(async (ctx) => {
      // 300 clientes cuyo nombre empieza por "622" (nombre inusual, pero
      // válido) satura nameMatches con el mismo término "622" que se va a
      // buscar por teléfono.
      for (let i = 0; i < LIST_LIMIT; i++) {
        const name = `622 Relleno ${i}`;
        await ctx.db.insert("clients", { name, nameFold: foldDiacritics(name) });
      }
    });
    const target = await t.mutation(api.clients.create, {
      token,
      name: "Objetivo Real",
      phone: "622334556",
    });

    const result = await t.query(api.clients.search, { token, search: "622" });
    expect(result.truncated).toBe(true);
    expect(result.items.some((item) => item.clientId === target)).toBe(true);
  }, 30000);

  test("un cliente creado después de otros LIST_LIMIT clientes sigue siendo encontrado por nombre", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < LIST_LIMIT; i++) {
        const name = `Relleno ${i}`;
        await ctx.db.insert("clients", { name, nameFold: foldDiacritics(name) });
      }
    });
    await t.mutation(api.clients.create, { token, name: "Zzz Objetivo", phone: "600111222" });

    const result = await t.query(api.clients.search, { token, search: "Objetivo" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Zzz Objetivo");
  }, 30000);

  test("cuando hay más de LIST_LIMIT coincidencias reales de teléfono, truncated true y solo se devuelven LIST_LIMIT items", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t);
    await t.run(async (ctx) => {
      for (let i = 0; i <= LIST_LIMIT; i++) {
        const phoneKey = `600${String(i).padStart(6, "0")}`;
        const name = `Cliente ${i}`;
        await ctx.db.insert("clients", { name, phone: phoneKey, phoneKey, nameFold: foldDiacritics(name) });
      }
    });

    const result = await t.query(api.clients.search, { token, search: "600" });
    expect(result.truncated).toBe(true);
    expect(result.items).toHaveLength(LIST_LIMIT);
  }, 30000);
});

// String.prototype.isWellFormed() es ES2024 — el tsconfig de convex/ fija
// deliberadamente lib: ["ES2023", "dom"] (comentado como "requerido por
// Convex", describe el runtime real de las funciones), así que no está
// disponible aquí aunque el tsconfig raíz del proyecto sí lo permita. Un
// string está "bien formado" si no contiene ningún surrogate UTF-16 suelto
// (alto sin su par bajo, o bajo sin su par alto) — la misma definición que
// isWellFormed(), expresada con una comprobación equivalente por regex.
function isWellFormedString(value: string): boolean {
  return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value);
}

describe("sanitizeNameQuery / truncateUtf8Bytes / truncateCodePoints (unidades puras)", () => {
  test("sanitizeNameQuery cuenta como máximo 16 palabras, separando también por puntuación (no solo espacios)", () => {
    const result = sanitizeNameQuery("a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q");
    expect(result.split(" ")).toHaveLength(16);
    expect(result).toBe("a b c d e f g h i j k l m n o p");
  });

  test("truncateUtf8Bytes con un par subrogado justo en el límite de bytes devuelve una cadena bien formada", () => {
    // 7 emojis (4 bytes cada uno = 28) + "a" (1 byte = 29) + un emoji más
    // (necesitaría 4 bytes más, hasta 33): el límite de 32 cae justo a
    // mitad del último par subrogado con un slice() ingenuo.
    const value = "😀".repeat(7) + "a" + "😀";
    const result = truncateUtf8Bytes(value, 32);
    expect(isWellFormedString(result)).toBe(true);
    expect(new TextEncoder().encode(result).length).toBeLessThanOrEqual(32);
  });

  test("truncateCodePoints no parte un par subrogado con una entrada de más de 100 caracteres de emoji", () => {
    const value = "😀".repeat(101);
    const result = truncateCodePoints(value, 100);
    expect(isWellFormedString(result)).toBe(true);
    expect([...result]).toHaveLength(100);
  });

  test("sanitizeNameQuery con una letra no-BMP (\\p{L}) cerca del límite de bytes hereda la garantía de truncateUtf8Bytes", () => {
    // 𐐀 (U+10400, letra mayúscula deseret) sí es \p{L} — a diferencia de
    // un emoji, atraviesa de verdad el filtro de sanitizeNameQuery antes
    // de llegar a truncateUtf8Bytes.
    const word = "𐐀".repeat(9);
    const result = sanitizeNameQuery(word);
    expect(isWellFormedString(result)).toBe(true);
    expect(new TextEncoder().encode(result).length).toBeLessThanOrEqual(32);
  });
});
