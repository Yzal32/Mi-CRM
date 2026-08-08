import { describe, expect, it } from "vitest";
import { hasFormErrors, validateNuevoClienteForm } from "./validateNuevoClienteForm";

const base = { name: "Carlos Ruiz", phone: "622334556", email: "" };

describe("validateNuevoClienteForm", () => {
  it("no da errores con nombre y teléfono válidos", () => {
    const errors = validateNuevoClienteForm(base);
    expect(hasFormErrors(errors)).toBe(false);
  });

  it("no da errores con nombre y solo email", () => {
    const errors = validateNuevoClienteForm({ name: "Ana Torres", phone: "", email: "ana@ejemplo.com" });
    expect(hasFormErrors(errors)).toBe(false);
  });

  it("exige nombre", () => {
    const errors = validateNuevoClienteForm({ ...base, name: "  " });
    expect(errors.name).toBeDefined();
  });

  it("exige teléfono o email cuando ambos están vacíos", () => {
    const errors = validateNuevoClienteForm({ name: "Cliente", phone: "", email: "" });
    expect(errors.form).toBeDefined();
    expect(errors.phone).toBeUndefined();
    expect(errors.email).toBeUndefined();
  });

  it("rechaza un teléfono con formato inválido, sin disparar el error de 'falta contacto'", () => {
    const errors = validateNuevoClienteForm({ name: "Cliente", phone: "abc", email: "" });
    expect(errors.phone).toBeDefined();
    expect(errors.form).toBeUndefined();
  });

  it("rechaza un email con formato inválido, sin disparar el error de 'falta contacto'", () => {
    const errors = validateNuevoClienteForm({ name: "Cliente", phone: "", email: "no-valido" });
    expect(errors.email).toBeDefined();
    expect(errors.form).toBeUndefined();
  });
});
