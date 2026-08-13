import { describe, expect, it } from "vitest";
import { hasFormErrors, validateRegistrarVentaForm } from "./validateRegistrarVentaForm";

const base = { description: "3x Camiseta talla M", amount: "45,50" };

describe("validateRegistrarVentaForm", () => {
  it("no da errores con descripción e importe válidos", () => {
    const errors = validateRegistrarVentaForm(base);
    expect(hasFormErrors(errors)).toBe(false);
  });

  it("exige descripción", () => {
    const errors = validateRegistrarVentaForm({ ...base, description: "  " });
    expect(errors.description).toBeDefined();
  });

  it("rechaza una descripción de más de 300 caracteres", () => {
    const errors = validateRegistrarVentaForm({ ...base, description: "a".repeat(301) });
    expect(errors.description).toBeDefined();
  });

  it("acepta una descripción de exactamente 300 caracteres", () => {
    const errors = validateRegistrarVentaForm({ ...base, description: "a".repeat(300) });
    expect(errors.description).toBeUndefined();
  });

  it("exige importe", () => {
    const errors = validateRegistrarVentaForm({ ...base, amount: "" });
    expect(errors.amount).toBeDefined();
  });

  it("rechaza un importe con formato inválido", () => {
    const errors = validateRegistrarVentaForm({ ...base, amount: "abc" });
    expect(errors.amount).toBeDefined();
  });

  it("rechaza importe cero", () => {
    const errors = validateRegistrarVentaForm({ ...base, amount: "0" });
    expect(errors.amount).toBeDefined();
  });

  it("rechaza importe negativo", () => {
    const errors = validateRegistrarVentaForm({ ...base, amount: "-5" });
    expect(errors.amount).toBeDefined();
  });

  // Límites de negocio de convex/model/sales.ts (AMOUNT_MIN_CENTS=1,
  // AMOUNT_MAX_CENTS=999_999_999).
  it("acepta el mínimo (1 céntimo)", () => {
    const errors = validateRegistrarVentaForm({ ...base, amount: "0,01" });
    expect(errors.amount).toBeUndefined();
  });

  it("acepta el máximo (999.999.999 céntimos)", () => {
    const errors = validateRegistrarVentaForm({ ...base, amount: "9999999,99" });
    expect(errors.amount).toBeUndefined();
  });

  it("rechaza máximo + 1 céntimo (1.000.000.000 céntimos)", () => {
    const errors = validateRegistrarVentaForm({ ...base, amount: "10000000,00" });
    expect(errors.amount).toBeDefined();
  });
});
