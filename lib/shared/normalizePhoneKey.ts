const ALLOWED_RAW_PATTERN = /^\+?[\d\s\-()]+$/;
const MIN_DIGITS = 6;
const MAX_DIGITS = 15;

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

  // El "+" es solo una señal de prefijo internacional durante el cálculo:
  // nunca sobrevive al valor devuelto, la clave final es siempre dígitos puros.
  let digits = digitsWithPlus.startsWith("+") ? digitsWithPlus.slice(1) : digitsWithPlus;

  if (digits.startsWith("0034")) {
    digits = digits.slice(4);
  } else if (digitsWithPlus.startsWith("+34")) {
    digits = digits.slice(2);
  }

  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
  return digits;
}
