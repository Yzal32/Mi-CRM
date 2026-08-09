import { describe, expect, it } from "vitest";
import { formatCurrencyEUR } from "./formatCurrency";

// El espacio entre el número y "€" que produce Intl.NumberFormat puede ser
// un espacio normal o uno de no separación (U+00A0) según el motor ICU del
// entorno — \s de una regex cubre ambos, a diferencia de un `.toBe()` con
// un espacio literal.
describe("formatCurrencyEUR", () => {
  it("formatea céntimos como euros con dos decimales", () => {
    expect(formatCurrencyEUR(4500)).toMatch(/^45,00\s€$/);
  });

  it("formatea cero", () => {
    expect(formatCurrencyEUR(0)).toMatch(/^0,00\s€$/);
  });

  it("formatea céntimos sueltos", () => {
    expect(formatCurrencyEUR(5)).toMatch(/^0,05\s€$/);
  });

  it("formatea importes grandes", () => {
    expect(formatCurrencyEUR(150000)).toMatch(/^1500,00\s€$/);
  });
});
