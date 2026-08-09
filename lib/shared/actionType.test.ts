import { describe, expect, it } from "vitest";
import { ACTION_TYPE_LABELS_ES, ACTION_TYPE_OPTIONS, type ActionType } from "./actionType";

const ALL_TYPES: ActionType[] = ["call", "whatsapp", "email", "visit"];

describe("ACTION_TYPE_LABELS_ES", () => {
  it("tiene una etiqueta en español para cada tipo de acción", () => {
    expect(ACTION_TYPE_LABELS_ES).toEqual({
      call: "Llamar",
      whatsapp: "WhatsApp",
      email: "Email",
      visit: "Visita",
    });
  });
});

describe("ACTION_TYPE_OPTIONS", () => {
  it("incluye una opción por cada tipo de acción, con la misma etiqueta que ACTION_TYPE_LABELS_ES", () => {
    expect(ACTION_TYPE_OPTIONS).toHaveLength(ALL_TYPES.length);
    for (const type of ALL_TYPES) {
      const option = ACTION_TYPE_OPTIONS.find((o) => o.value === type);
      expect(option?.label).toBe(ACTION_TYPE_LABELS_ES[type]);
    }
  });
});
