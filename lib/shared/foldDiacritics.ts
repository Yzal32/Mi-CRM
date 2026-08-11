/**
 * Pliega diacriticos y mayusculas para comparacion de texto insensible a
 * acentos ("maria" debe encontrar "Maria" con tilde, "nunez" debe encontrar
 * "Nunez" con enye): descompone en NFD (separa cada letra acentuada en su
 * letra base + marca combinante, p. ej. "i" con tilde se descompone en "i"
 * + U+0301) y descarta el rango Unicode de marcas combinantes diacriticas
 * (U+0300 a U+036F) -- incluye la marca de la "enye" a proposito: para
 * busqueda, mas permisivo es mejor (un trabajador que escribe rapido y no
 * pone la tilde/eñe debe encontrar igual al cliente).
 *
 * Uso: mantener clients.nameFold (convex/model/clients.ts) y normalizar el
 * termino de busqueda antes de consultar el indice de texto
 * (convex/clients.ts, search).
 */
const COMBINING_DIACRITICAL_MARKS_START = 0x0300;
const COMBINING_DIACRITICAL_MARKS_END = 0x036f;

function stripCombiningMarks(value: string): string {
  let result = "";
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint >= COMBINING_DIACRITICAL_MARKS_START && codePoint <= COMBINING_DIACRITICAL_MARKS_END) continue;
    result += char;
  }
  return result;
}

export function foldDiacritics(value: string): string {
  return stripCombiningMarks(value.normalize("NFD")).toLowerCase();
}
