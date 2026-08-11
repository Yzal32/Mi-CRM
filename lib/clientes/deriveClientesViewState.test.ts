import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { deriveClientesViewState, type ClientesSearchResult } from "./deriveClientesViewState";

const client = (overrides: Partial<ClientesSearchResult["items"][number]> = {}): ClientesSearchResult["items"][number] => ({
  clientId: "c1" as Id<"clients">,
  name: "Cliente",
  phone: "622334556",
  status: undefined,
  followUp: undefined,
  ...overrides,
});

describe("deriveClientesViewState", () => {
  it("es 'loading' mientras la query no resuelve, con o sin término", () => {
    expect(deriveClientesViewState({ data: undefined, hasSearchTerm: false })).toBe("loading");
    expect(deriveClientesViewState({ data: undefined, hasSearchTerm: true })).toBe("loading");
  });

  it("es 'empty' sin término y sin resultados (tabla clients vacía de verdad)", () => {
    const data: ClientesSearchResult = { items: [], truncated: false };
    expect(deriveClientesViewState({ data, hasSearchTerm: false })).toBe("empty");
  });

  it("es 'noResults' con término y sin resultados", () => {
    const data: ClientesSearchResult = { items: [], truncated: false };
    expect(deriveClientesViewState({ data, hasSearchTerm: true })).toBe("noResults");
  });

  it("es 'hasResults' con coincidencias, con o sin término", () => {
    const data: ClientesSearchResult = { items: [client()], truncated: false };
    expect(deriveClientesViewState({ data, hasSearchTerm: false })).toBe("hasResults");
    expect(deriveClientesViewState({ data, hasSearchTerm: true })).toBe("hasResults");
  });

  it("es 'hasResults' con coincidencias aunque truncated sea true", () => {
    const data: ClientesSearchResult = { items: [client()], truncated: true };
    expect(deriveClientesViewState({ data, hasSearchTerm: true })).toBe("hasResults");
  });
});
