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
  it("usa 'hoy' cuando diffDays es 0 o negativo", () => {
    expect(followUpLabel("call", 0)).toBe("Llamar · hoy");
    expect(followUpLabel("visit", -1)).toBe("Visita · hoy");
  });

  it("usa 'venció ayer' cuando diffDays es 1", () => {
    expect(followUpLabel("call", 1)).toBe("Llamar · venció ayer");
  });

  it("usa 'hace N días' cuando diffDays es mayor que 1", () => {
    expect(followUpLabel("whatsapp", 3)).toBe("WhatsApp · hace 3 días");
    expect(followUpLabel("email", 10)).toBe("Email · hace 10 días");
  });
});
