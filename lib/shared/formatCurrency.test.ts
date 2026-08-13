import { describe, expect, it } from "vitest";
import { formatCurrencyEUR, parseCurrencyEUR } from "./formatCurrency";

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

describe("parseCurrencyEUR", () => {
  it("parsea un entero", () => {
    expect(parseCurrencyEUR("45")).toBe(4500);
  });

  it("parsea con coma y un decimal", () => {
    expect(parseCurrencyEUR("45,5")).toBe(4550);
  });

  it("parsea con coma y dos decimales", () => {
    expect(parseCurrencyEUR("45,50")).toBe(4550);
  });

  it("parsea con punto como separador decimal", () => {
    expect(parseCurrencyEUR("45.50")).toBe(4550);
  });

  it("céntimos sueltos", () => {
    expect(parseCurrencyEUR("0,01")).toBe(1);
  });

  it("rechaza separador de miles", () => {
    expect(parseCurrencyEUR("1.234")).toBeNull();
  });

  it("rechaza doble separador (miles + decimal)", () => {
    expect(parseCurrencyEUR("1.234,56")).toBeNull();
    expect(parseCurrencyEUR("1,234.56")).toBeNull();
  });

  it("rechaza más de dos decimales", () => {
    expect(parseCurrencyEUR("45,505")).toBeNull();
  });

  it("rechaza el símbolo €", () => {
    expect(parseCurrencyEUR("45 €")).toBeNull();
  });

  it("rechaza signo negativo", () => {
    expect(parseCurrencyEUR("-45")).toBeNull();
  });

  it("rechaza separador sin dígitos detrás", () => {
    expect(parseCurrencyEUR("45,")).toBeNull();
  });

  it("rechaza separador sin dígitos delante", () => {
    expect(parseCurrencyEUR(",45")).toBeNull();
  });

  it("rechaza cadena vacía", () => {
    expect(parseCurrencyEUR("")).toBeNull();
  });

  it("rechaza texto no numérico", () => {
    expect(parseCurrencyEUR("abc")).toBeNull();
  });

  // Regresión: una primera versión usaba trim() antes de validar, lo que
  // aceptaba espacios exteriores en contra de la gramática declarada.
  it("rechaza espacios exteriores (sin trim)", () => {
    expect(parseCurrencyEUR(" 45")).toBeNull();
    expect(parseCurrencyEUR("45 ")).toBeNull();
    expect(parseCurrencyEUR(" 45 ")).toBeNull();
  });

  it("rechaza espacios internos", () => {
    expect(parseCurrencyEUR("45 ,50")).toBeNull();
  });
});
