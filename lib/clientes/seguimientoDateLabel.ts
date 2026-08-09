import { calendarDayDiff, formatBusinessDate } from "@/lib/shared/businessDay";

/**
 * Etiqueta de fecha para el seguimiento pendiente de un cliente: "Hoy" si
 * coincide con hoy, "Atrasado (dd/mm/yyyy)" desde el día siguiente a su
 * fecha (ver PRO-7), o "dd/mm/yyyy" si todavía es una fecha futura.
 */
export function seguimientoDateLabel(dueDate: string, today: string): string {
  const diff = calendarDayDiff(dueDate, today); // today - dueDate
  if (diff === 0) return "Hoy";
  if (diff > 0) return `Atrasado (${formatBusinessDate(dueDate)})`;
  return formatBusinessDate(dueDate);
}
