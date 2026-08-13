/**
 * Formatea un importe en céntimos de euro (entero) como "45,00 €" — ver
 * convex/model/sales.ts para por qué el dinero se guarda en céntimos
 * (evita errores de redondeo de coma flotante en JS).
 */
export function formatCurrencyEUR(amountCents: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amountCents / 100);
}

const AMOUNT_PATTERN = /^(\d+)(?:[.,](\d{1,2}))?$/;

/**
 * Inversa de formatCurrencyEUR: parsea un importe en euros escrito por el
 * usuario a céntimos enteros. Gramática estricta, sin excepciones: dígitos
 * con como mucho un separador decimal (coma o punto) y 1-2 decimales.
 * Rechaza (null) separadores de miles, doble separador, cualquier espacio,
 * el símbolo €, signo negativo y separador sin dígitos a un lado.
 *
 * Sin trim(): un espacio exterior debe rechazarse, no ignorarse — si se
 * recortara aquí, " 45 " pasaría a "45" y se aceptaría, contradiciendo la
 * gramática. Conversión con aritmética de dígitos enteros (nunca
 * parseFloat(...) * 100) para no introducir el error de redondeo de coma
 * flotante que motiva que amountCents se guarde en céntimos (ver
 * convex/model/sales.ts).
 */
export function parseCurrencyEUR(input: string): number | null {
  const match = AMOUNT_PATTERN.exec(input);
  if (!match) return null;
  const [, wholePart, fractionPart = ""] = match;
  const cents = Number(wholePart) * 100 + Number(fractionPart.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
