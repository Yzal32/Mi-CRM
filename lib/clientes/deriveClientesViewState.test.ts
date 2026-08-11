import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { deriveClientesViewState, type ClientesSearchResult } from "./deriveClientesViewState";

const client = (overrides: Partial<ClientesSearchResult["items"][number]> = {}) => ({
  clientId: "c1" as Id<"clients">,
  name: "Cliente",
  phone: "622334556",
  ...overrides,
});

describe("deriveClientesViewState", () => {
  it("es 'idle' sin término de búsqueda, incluso si data está undefined", () => {
    expect(deriveClientesViewState({ data: undefined, hasSearchTerm: false })).toBe("idle");
  });

  it("es 'loading' con término mientras la query no resuelve", () => {
    expect(deriveClientesViewState({ data: undefined, hasSearchTerm: true })).toBe("loading");
  });

  it("es 'noResults' con búsqueda y resultado vacío", () => {
    const data: ClientesSearchResult = { items: [], truncated: false };
    expect(deriveClientesViewState({ data, hasSearchTerm: true })).toBe("noResults");
  });

  it("es 'hasResults' con coincidencias", () => {
    const data: ClientesSearchResult = { items: [client()], truncated: false };
    expect(deriveClientesViewState({ data, hasSearchTerm: true })).toBe("hasResults");
  });

  it("es 'hasResults' con coincidencias aunque truncated sea true", () => {
    const data: ClientesSearchResult = { items: [client()], truncated: true };
    expect(deriveClientesViewState({ data, hasSearchTerm: true })).toBe("hasResults");
  });
});
