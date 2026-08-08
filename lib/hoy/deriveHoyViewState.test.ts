import { describe, expect, it } from "vitest";
import { deriveHoyViewState, type ListTodayResult } from "./deriveHoyViewState";

const item = (overrides: Partial<ListTodayResult["overdue"][number]> = {}) => ({
  followUpId: "f1",
  clientId: "c1",
  clientName: "Cliente",
  actionType: "call" as const,
  diffDays: 0,
  ...overrides,
});

describe("deriveHoyViewState", () => {
  it("es 'loading' mientras data es undefined", () => {
    expect(deriveHoyViewState({ data: undefined, hasSearchTerm: false })).toBe("loading");
  });

  it("es 'allCaughtUp' sin búsqueda y sin seguimientos pendientes", () => {
    const data: ListTodayResult = { overdue: [], overdueTruncated: false, today: [], todayTruncated: false };
    expect(deriveHoyViewState({ data, hasSearchTerm: false })).toBe("allCaughtUp");
  });

  it("es 'hasData' sin búsqueda cuando hay seguimientos", () => {
    const data: ListTodayResult = { overdue: [item()], overdueTruncated: false, today: [], todayTruncated: false };
    expect(deriveHoyViewState({ data, hasSearchTerm: false })).toBe("hasData");
  });

  it("es 'noResults' con búsqueda, resultado vacío, sin truncar", () => {
    const data: ListTodayResult = { overdue: [], overdueTruncated: false, today: [], todayTruncated: false };
    expect(deriveHoyViewState({ data, hasSearchTerm: true })).toBe("noResults");
  });

  it("es 'possiblyMoreMatches' con búsqueda, resultado vacío, y overdueTruncated (bug de la ronda 3)", () => {
    const data: ListTodayResult = { overdue: [], overdueTruncated: true, today: [], todayTruncated: false };
    expect(deriveHoyViewState({ data, hasSearchTerm: true })).toBe("possiblyMoreMatches");
  });

  it("es 'possiblyMoreMatches' con búsqueda, resultado vacío, y todayTruncated", () => {
    const data: ListTodayResult = { overdue: [], overdueTruncated: false, today: [], todayTruncated: true };
    expect(deriveHoyViewState({ data, hasSearchTerm: true })).toBe("possiblyMoreMatches");
  });

  it("es 'hasData' con búsqueda cuando hay resultados visibles, aunque algo esté truncado", () => {
    const data: ListTodayResult = { overdue: [item()], overdueTruncated: true, today: [], todayTruncated: false };
    expect(deriveHoyViewState({ data, hasSearchTerm: true })).toBe("hasData");
  });
});
