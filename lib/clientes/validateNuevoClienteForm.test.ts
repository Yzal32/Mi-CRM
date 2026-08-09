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

  it("rechaza un teléfono de más de 30 caracteres aunque el formato y el número de dígitos sean válidos", () => {
    // 10 dígitos (formato válido, dentro del rango 6-15 de normalizePhoneKey)
    // separados por guiones de sobra: 37 caracteres en total.
    const longPhone = "6---2---2---3---3---4---5---5---6---6";
    const errors = validateNuevoClienteForm({ name: "Cliente", phone: longPhone, email: "" });
    expect(errors.phone).toBeDefined();
  });

  it("rechaza un email de más de 200 caracteres aunque el formato sea válido", () => {
    const longEmail = `${"a".repeat(195)}@x.com`;
    const errors = validateNuevoClienteForm({ name: "Cliente", phone: "", email: longEmail });
    expect(errors.email).toBeDefined();
  });
});
