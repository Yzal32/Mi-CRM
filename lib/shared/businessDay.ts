/**
 * Fecha civil del negocio ("día de negocio"), compartida entre el cliente
 * (Next.js) y el servidor (Convex) para que la zona horaria y la lógica de
 * cálculo nunca diverjan entre ambos.
 */

export const BUSINESS_TIMEZONE = "Europe/Madrid";

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_YEAR = 1970;
const MAX_YEAR = 2999;

/**
 * Fecha civil "YYYY-MM-DD" de `date` en `timeZone`. Usa `formatToParts` en
 * vez del string de una locale (p. ej. "en-CA") porque el formato exacto de
 * separadores de una locale no está garantizado en todos los runtimes.
 */
export function businessDayKey(date: Date = new Date(), timeZone: string = BUSINESS_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`No se pudo formatear la fecha: falta la parte "${type}"`);
    return part.value;
  };
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * true si `value` es una fecha civil "YYYY-MM-DD" real (rechaza formatos
 * malformados, fechas inexistentes como "2026-02-30", y años fuera de un
 * rango razonable — evita la peculiaridad de Date.UTC con años 0-99, donde
 * un año de dos dígitos se reinterpreta como 19XX).
 */
export function isValidBusinessDayKey(value: string): boolean {
  if (!DAY_KEY_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y < MIN_YEAR || y > MAX_YEAR) return false;
  const asUTC = Date.UTC(y, m - 1, d);
  // Round-trip: si Date.UTC normalizó una fecha inexistente (p. ej. "2026-02-30"
  // se convierte en 2026-03-02), el resultado ya no coincide con el original.
  return businessDayKey(new Date(asUTC), "UTC") === value;
}

/**
 * Diferencia en días de calendario entre dos claves "YYYY-MM-DD" (toKey - fromKey).
 * Ambas se anclan a medianoche UTC nominal solo para la resta — es seguro
 * porque son fechas civiles, no instantes de tiempo real.
 */
export function calendarDayDiff(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const fromUTC = Date.UTC(fy, fm - 1, fd);
  const toUTC = Date.UTC(ty, tm - 1, td);
  return Math.round((toUTC - fromUTC) / (24 * 60 * 60 * 1000));
}
