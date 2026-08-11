import { describe, expect, it } from "vitest";
import { actionIcon, followUpLabel } from "./followUpPresentation";

describe("actionIcon", () => {
  it("mapea cada tipo de acción a su icono", () => {
    expect(actionIcon("call")).toBe("phone");
    expect(actionIcon("whatsapp")).toBe("message-circle");
    expect(actionIcon("email")).toBe("mail");
    expect(actionIcon("visit")).toBe("map-pin");
  });
});

describe("followUpLabel", () => {
  it("usa 'hoy' cuando diffDays es exactamente 0", () => {
    expect(followUpLabel("call", 0)).toBe("Llamar · hoy");
  });

  it("usa 'venció ayer' cuando diffDays es 1", () => {
    expect(followUpLabel("call", 1)).toBe("Llamar · venció ayer");
  });

  it("usa 'hace N días' cuando diffDays es mayor que 1", () => {
    expect(followUpLabel("whatsapp", 3)).toBe("WhatsApp · hace 3 días");
    expect(followUpLabel("email", 10)).toBe("Email · hace 10 días");
  });

  // PRO-19: diffDays negativo (seguimiento futuro) — listToday nunca lo
  // pasaba, así que este caso no se había ejercitado hasta ahora.
  it("usa 'mañana' cuando diffDays es -1", () => {
    expect(followUpLabel("visit", -1)).toBe("Visita · mañana");
  });

  it("usa 'en N días' cuando diffDays es menor que -1", () => {
    expect(followUpLabel("email", -3)).toBe("Email · en 3 días");
  });
});
