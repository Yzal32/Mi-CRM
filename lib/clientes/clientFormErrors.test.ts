import { describe, expect, it } from "vitest";
import { clientFormErrorsFromConvexCode } from "./clientFormErrors";

describe("clientFormErrorsFromConvexCode", () => {
  it("DUPLICATE_PHONE marca el campo teléfono", () => {
    expect(clientFormErrorsFromConvexCode("DUPLICATE_PHONE")).toEqual({
      phone: "Ya existe un cliente con este teléfono.",
    });
  });

  it("INVALID_PHONE marca el campo teléfono", () => {
    expect(clientFormErrorsFromConvexCode("INVALID_PHONE")).toEqual({
      phone: "Ese teléfono no es válido.",
    });
  });

  it("INVALID_EMAIL marca el campo email", () => {
    expect(clientFormErrorsFromConvexCode("INVALID_EMAIL")).toEqual({
      email: "Ese email no es válido.",
    });
  });

  it("NAME_REQUIRED marca el campo nombre", () => {
    expect(clientFormErrorsFromConvexCode("NAME_REQUIRED")).toEqual({
      name: "Introduce el nombre del cliente.",
    });
  });

  it("NAME_TOO_LONG marca el campo nombre", () => {
    expect(clientFormErrorsFromConvexCode("NAME_TOO_LONG")).toEqual({
      name: "El nombre es demasiado largo.",
    });
  });

  it("CONTACT_REQUIRED marca el banner general", () => {
    expect(clientFormErrorsFromConvexCode("CONTACT_REQUIRED")).toEqual({
      form: "Necesitas al menos un teléfono o un email para guardar el cliente.",
    });
  });

  it("código desconocido o ausente marca el banner general genérico", () => {
    expect(clientFormErrorsFromConvexCode(undefined)).toEqual({
      form: "No se pudo guardar el cliente. Inténtalo de nuevo.",
    });
    expect(clientFormErrorsFromConvexCode("ALGO_INESPERADO")).toEqual({
      form: "No se pudo guardar el cliente. Inténtalo de nuevo.",
    });
  });
});
