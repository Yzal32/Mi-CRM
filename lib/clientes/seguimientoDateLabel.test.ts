import { describe, expect, it } from "vitest";
import { seguimientoDateLabel } from "./seguimientoDateLabel";

describe("seguimientoDateLabel", () => {
  it('devuelve "Hoy" cuando dueDate coincide con today', () => {
    expect(seguimientoDateLabel("2026-08-08", "2026-08-08")).toBe("Hoy");
  });

  it('devuelve "Atrasado (dd/mm/yyyy)" desde el día siguiente a la fecha', () => {
    expect(seguimientoDateLabel("2026-08-07", "2026-08-08")).toBe("Atrasado (07/08/2026)");
  });

  it("sigue marcando atrasado con fechas muy antiguas", () => {
    expect(seguimientoDateLabel("2020-01-01", "2026-08-08")).toBe("Atrasado (01/01/2020)");
  });

  it("una fecha futura se muestra sin prefijo", () => {
    expect(seguimientoDateLabel("2026-08-09", "2026-08-08")).toBe("09/08/2026");
  });
});
