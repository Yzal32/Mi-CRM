import { describe, expect, it } from "vitest";
import { businessDayKey, calendarDayDiff, isValidBusinessDayKey } from "./businessDay";

describe("businessDayKey", () => {
  it("formatea en YYYY-MM-DD para la zona de Madrid", () => {
    // 2026-06-15T10:00:00Z -> mediodía en Madrid en verano (UTC+2)
    expect(businessDayKey(new Date("2026-06-15T10:00:00Z"))).toBe("2026-06-15");
  });

  it("distingue medianoche UTC de medianoche de Madrid en invierno (UTC+1)", () => {
    // 2026-01-01T23:30:00Z todavía es 2026-01-02 en Madrid (invierno, UTC+1)
    expect(businessDayKey(new Date("2026-01-01T23:30:00Z"))).toBe("2026-01-02");
  });

  it("distingue medianoche UTC de medianoche de Madrid en verano (UTC+2)", () => {
    // 2026-07-01T22:30:00Z todavía es 2026-07-02 en Madrid (verano, UTC+2)
    expect(businessDayKey(new Date("2026-07-01T22:30:00Z"))).toBe("2026-07-02");
  });

  it("cruza correctamente el cambio de horario de primavera en Madrid (2026-03-29)", () => {
    // A las 00:30 UTC del 29 de marzo de 2026 todavía es invierno en Madrid (UTC+1) -> 2026-03-29 01:30 local
    expect(businessDayKey(new Date("2026-03-29T00:30:00Z"))).toBe("2026-03-29");
    // A las 23:30 UTC del mismo día ya es verano en Madrid (UTC+2) -> 2026-03-30 01:30 local
    expect(businessDayKey(new Date("2026-03-29T23:30:00Z"))).toBe("2026-03-30");
  });

  it("cruza correctamente el cambio de horario de otoño en Madrid (2026-10-25)", () => {
    expect(businessDayKey(new Date("2026-10-25T21:30:00Z"))).toBe("2026-10-25");
    expect(businessDayKey(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
  });

  it("no depende de la zona horaria del proceso/dispositivo", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "America/Los_Angeles";
      // El mismo instante que en el test de invierno de arriba: debe seguir
      // devolviendo la fecha civil de Madrid, no la de Los Ángeles.
      expect(businessDayKey(new Date("2026-01-01T23:30:00Z"))).toBe("2026-01-02");
    } finally {
      process.env.TZ = original;
    }
  });
});

describe("isValidBusinessDayKey", () => {
  it("acepta fechas civiles reales", () => {
    expect(isValidBusinessDayKey("2026-08-08")).toBe(true);
    expect(isValidBusinessDayKey("2000-01-01")).toBe(true);
    expect(isValidBusinessDayKey("2026-12-31")).toBe(true);
  });

  it("rechaza fechas inexistentes", () => {
    expect(isValidBusinessDayKey("2026-02-30")).toBe(false);
    expect(isValidBusinessDayKey("2026-13-01")).toBe(false);
    expect(isValidBusinessDayKey("2026-00-01")).toBe(false);
    expect(isValidBusinessDayKey("2026-01-32")).toBe(false);
  });

  it("rechaza formatos malformados", () => {
    expect(isValidBusinessDayKey("2026-8-8")).toBe(false);
    expect(isValidBusinessDayKey("08-08-2026")).toBe(false);
    expect(isValidBusinessDayKey("2026/08/08")).toBe(false);
    expect(isValidBusinessDayKey("hoy")).toBe(false);
    expect(isValidBusinessDayKey("")).toBe(false);
    expect(isValidBusinessDayKey("9999999-12-31")).toBe(false);
  });

  it("rechaza años fuera del rango razonable (evita la peculiaridad de años 0-99 de Date.UTC)", () => {
    expect(isValidBusinessDayKey("0099-01-01")).toBe(false);
    expect(isValidBusinessDayKey("0001-01-01")).toBe(false);
  });
});

describe("calendarDayDiff", () => {
  it("es 0 para el mismo día", () => {
    expect(calendarDayDiff("2026-08-08", "2026-08-08")).toBe(0);
  });

  it("cuenta días positivos hacia adelante", () => {
    expect(calendarDayDiff("2026-08-08", "2026-08-09")).toBe(1);
    expect(calendarDayDiff("2026-08-08", "2026-08-11")).toBe(3);
  });

  it("cuenta días negativos hacia atrás", () => {
    expect(calendarDayDiff("2026-08-08", "2026-08-07")).toBe(-1);
  });

  it("cruza límites de mes y año correctamente", () => {
    expect(calendarDayDiff("2026-01-31", "2026-02-01")).toBe(1);
    expect(calendarDayDiff("2025-12-31", "2026-01-01")).toBe(1);
  });
});
