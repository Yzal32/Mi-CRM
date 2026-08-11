const ALLOWED_RAW_PATTERN = /^\+?[\d\s\-()]+$/;
const MIN_DIGITS = 6;
const MAX_DIGITS = 15;

// Recorta el prefijo español (+34 / 0034) de una cadena ya despojada de
// espacios/guiones/paréntesis. Compartido por normalizePhoneKey (exige que
// el resultado tenga 6–15 dígitos) y phoneSearchDigits (no exige nada: un
// término de búsqueda a medio escribir es válido). El "+" es solo una señal
// de prefijo internacional durante el cálculo: nunca sobrevive al valor
// devuelto.
function stripSpainPrefix(digitsWithPlus: string): string {
  let digits = digitsWithPlus.startsWith("+") ? digitsWithPlus.slice(1) : digitsWithPlus;
  if (digits.startsWith("0034")) {
    digits = digits.slice(4);
  } else if (digitsWithPlus.startsWith("+34")) {
    digits = digits.slice(2);
  }
  return digits;
}

/**
 * Clave canónica de un teléfono (solo dígitos, sin "+") para detectar
 * duplicados entre formatos equivalentes ("622 334 556", "+34 622 334 556",
 * "0034622334556" deben coincidir). `null` si `raw` no es un teléfono válido.
 *
 * Importante: si `raw` contiene cualquier carácter que no sea dígito,
 * espacio, guion, paréntesis o un "+" inicial (p. ej. letras), se rechaza
 * la cadena entera — nunca se extraen los dígitos de en medio de un string
 * inválido ("abc622334556" no debe colarse como "622334556").
 */
export function normalizePhoneKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (!ALLOWED_RAW_PATTERN.test(trimmed)) return null;

  const digitsWithPlus = trimmed.replace(/[\s\-()]/g, "");
  const digits = stripSpainPrefix(digitsWithPlus);

  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
  return digits;
}

/**
 * Dígitos de búsqueda de un término parcial de teléfono: mismo recorte de
 * prefijo +34/0034 que normalizePhoneKey, pero tolerante — ignora
 * cualquier ruido antes del primer dígito o signo '+' (p. ej. una etiqueta
 * como "Tel: "), no exige longitud mínima (un término a medio escribir,
 * p. ej. "622", es una búsqueda válida), y nunca rechaza la entrada
 * entera. Uso: convex/clients.ts (search), como prefijo de rango sobre
 * by_phoneKey — no como término de un índice de texto.
 */
export function phoneSearchDigits(raw: string): string {
  // Busca el primer tramo que empiece por dígito o '+': descarta ruido de
  // texto ANTES de reconocer el prefijo — limpiarlo DESPUÉS (o con un
  // "quita todo lo que no sea dígito" ingenuo) dejaría el "34" de
  // "Tel: +34 622 334 556" pegado al resultado en vez de reconocerlo como
  // prefijo a recortar.
  const match = raw.match(/[+\d][\d\s\-()]*/);
  if (!match) return "";
  const digitsWithPlus = match[0].replace(/[\s\-()]/g, "");
  return stripSpainPrefix(digitsWithPlus).replace(/\D/g, "");
}
