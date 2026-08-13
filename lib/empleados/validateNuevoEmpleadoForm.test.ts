import { describe, expect, it } from "vitest";
import { hasFormErrors, validateNuevoEmpleadoForm } from "./validateNuevoEmpleadoForm";

const base = { name: "Carlos Ruiz", email: "carlos@ejemplo.com", password: "contraseña-segura" };

describe("validateNuevoEmpleadoForm", () => {
  it("no da errores con los tres campos válidos", () => {
    const errors = validateNuevoEmpleadoForm(base);
    expect(hasFormErrors(errors)).toBe(false);
  });

  it("exige nombre", () => {
    const errors = validateNuevoEmpleadoForm({ ...base, name: "  " });
    expect(errors.name).toBeDefined();
  });

  it("rechaza un nombre de más de 200 caracteres", () => {
    const errors = validateNuevoEmpleadoForm({ ...base, name: "a".repeat(201) });
    expect(errors.name).toBeDefined();
  });

  it("exige email", () => {
    const errors = validateNuevoEmpleadoForm({ ...base, email: "  " });
    expect(errors.email).toBeDefined();
  });

  it("rechaza un email con formato inválido", () => {
    const errors = validateNuevoEmpleadoForm({ ...base, email: "no-valido" });
    expect(errors.email).toBeDefined();
  });

  it("rechaza un email de más de 200 caracteres aunque el formato sea válido", () => {
    const longEmail = `${"a".repeat(195)}@x.com`;
    const errors = validateNuevoEmpleadoForm({ ...base, email: longEmail });
    expect(errors.email).toBeDefined();
  });

  it("exige contraseña", () => {
    const errors = validateNuevoEmpleadoForm({ ...base, password: "" });
    expect(errors.password).toBeDefined();
  });

  it("rechaza una contraseña de 7 caracteres (por debajo del mínimo)", () => {
    const errors = validateNuevoEmpleadoForm({ ...base, password: "a".repeat(7) });
    expect(errors.password).toBeDefined();
  });

  it("acepta una contraseña de 8 caracteres (frontera exacta del mínimo)", () => {
    const errors = validateNuevoEmpleadoForm({ ...base, password: "a".repeat(8) });
    expect(errors.password).toBeUndefined();
  });

  it("rechaza una contraseña de 1001 caracteres (frontera exacta del máximo)", () => {
    const errors = validateNuevoEmpleadoForm({ ...base, password: "a".repeat(1001) });
    expect(errors.password).toBe("La contraseña es demasiado larga.");
  });

  it("acepta una contraseña de exactamente 1000 caracteres", () => {
    const errors = validateNuevoEmpleadoForm({ ...base, password: "a".repeat(1000) });
    expect(errors.password).toBeUndefined();
  });
});
