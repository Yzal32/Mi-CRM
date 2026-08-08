import { describe, expect, it } from "vitest";
import { isValidEmail } from "./isValidEmail";

describe("isValidEmail", () => {
  it("acepta direcciones con forma normal", () => {
    expect(isValidEmail("marta@example.com")).toBe(true);
    expect(isValidEmail("  carlos@negocio.es  ")).toBe(true);
  });

  it("rechaza cadenas sin arroba o sin dominio", () => {
    expect(isValidEmail("marta")).toBe(false);
    expect(isValidEmail("marta@")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("marta@example")).toBe(false);
  });

  it("rechaza espacios internos", () => {
    expect(isValidEmail("marta @example.com")).toBe(false);
    expect(isValidEmail("marta@ example.com")).toBe(false);
  });

  it("rechaza cadena vacía", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("   ")).toBe(false);
  });
});
