import { describe, expect, it } from "vitest";
import { foldDiacritics } from "./foldDiacritics";

describe("foldDiacritics", () => {
  it("quita tildes y pliega mayusculas", () => {
    expect(foldDiacritics("María")).toBe("maria");
    expect(foldDiacritics("MARÍA")).toBe("maria");
  });

  it("pliega la marca de la eñe tambien (busqueda mas permisiva a proposito)", () => {
    expect(foldDiacritics("Núñez")).toBe("nunez");
  });

  it("pliega otros acentos habituales en nombres", () => {
    expect(foldDiacritics("José")).toBe("jose");
    expect(foldDiacritics("Ángela")).toBe("angela");
  });

  it("no cambia texto que ya no tiene diacriticos", () => {
    expect(foldDiacritics("Carlos Ruiz")).toBe("carlos ruiz");
  });

  it("cadena vacia devuelve cadena vacia", () => {
    expect(foldDiacritics("")).toBe("");
  });
});
