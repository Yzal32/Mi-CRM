import { describe, expect, it } from "vitest";
import { normalizePhoneKey, phoneSearchDigits } from "./normalizePhoneKey";

describe("normalizePhoneKey", () => {
  it("acepta un número nacional simple", () => {
    expect(normalizePhoneKey("622334556")).toBe("622334556");
  });

  it("quita espacios, guiones y paréntesis", () => {
    expect(normalizePhoneKey("622 334 556")).toBe("622334556");
    expect(normalizePhoneKey("622-334-556")).toBe("622334556");
    expect(normalizePhoneKey("(622) 334 556")).toBe("622334556");
  });

  it("recorta el prefijo español +34 y 0034 al mismo número nacional", () => {
    expect(normalizePhoneKey("+34 622 334 556")).toBe("622334556");
    expect(normalizePhoneKey("0034622334556")).toBe("622334556");
    expect(normalizePhoneKey("622334556")).toBe("622334556");
  });

  it("conserva los dígitos de un prefijo internacional distinto de España, pero nunca el '+'", () => {
    expect(normalizePhoneKey("+33 612 345 678")).toBe("33612345678");
    expect(normalizePhoneKey("+33 612 345 678")).not.toContain("+");
  });

  it("rechaza la cadena entera si contiene letras, en vez de extraer solo los dígitos", () => {
    expect(normalizePhoneKey("abc622334556")).toBeNull();
    expect(normalizePhoneKey("622334556x")).toBeNull();
    expect(normalizePhoneKey("llámame")).toBeNull();
  });

  it("rechaza menos de 6 dígitos", () => {
    expect(normalizePhoneKey("12345")).toBeNull();
  });

  it("rechaza más de 15 dígitos", () => {
    expect(normalizePhoneKey("1234567890123456")).toBeNull();
  });

  it("rechaza cadena vacía", () => {
    expect(normalizePhoneKey("")).toBeNull();
    expect(normalizePhoneKey("   ")).toBeNull();
  });

  it("solo permite un '+' inicial, no en cualquier posición", () => {
    expect(normalizePhoneKey("622+334556")).toBeNull();
  });
});

describe("phoneSearchDigits", () => {
  it("recorta +34/0034 igual que normalizePhoneKey", () => {
    expect(phoneSearchDigits("+34 622 334 556")).toBe("622334556");
    expect(phoneSearchDigits("0034622334556")).toBe("622334556");
  });

  it("acepta términos cortos que normalizePhoneKey rechazaría", () => {
    expect(phoneSearchDigits("622")).toBe("622");
    expect(normalizePhoneKey("622")).toBeNull();
  });

  it("descarta ruido no numérico en vez de rechazar la cadena entera", () => {
    expect(phoneSearchDigits("abc622")).toBe("622");
  });

  it("reconoce el prefijo aunque haya texto antes", () => {
    expect(phoneSearchDigits("Tel: +34 622 334 556")).toBe("622334556");
  });

  it("cadena vacía, solo espacios, o sin ningún dígito/'+' devuelve cadena vacía", () => {
    expect(phoneSearchDigits("")).toBe("");
    expect(phoneSearchDigits("   ")).toBe("");
    expect(phoneSearchDigits("llámame")).toBe("");
  });
});
