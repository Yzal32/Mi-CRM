/**
 * Formatea un importe en céntimos de euro (entero) como "45,00 €" — ver
 * convex/model/sales.ts para por qué el dinero se guarda en céntimos
 * (evita errores de redondeo de coma flotante en JS).
 */
export function formatCurrencyEUR(amountCents: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amountCents / 100);
}
