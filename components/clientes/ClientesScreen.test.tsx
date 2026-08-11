// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ClientesScreen } from "./ClientesScreen";

const useQueryMock = vi.fn();
vi.mock("@/lib/convex/authedHooks", () => ({
  useAuthedQuery: (...args: unknown[]) => useQueryMock(...args),
}));

afterEach(() => {
  cleanup();
  useQueryMock.mockReset();
  vi.useRealTimers();
});

function getSearchInput() {
  return screen.getByRole("textbox", { name: "Buscar por nombre o teléfono" });
}

describe("ClientesScreen — búsqueda con debounce", () => {
  it('sin escribir nada, useAuthedQuery se llama con "skip" (nunca dispara la query)', () => {
    useQueryMock.mockReturnValue(undefined);
    render(<ClientesScreen />);
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), "skip");
  });

  it("al escribir, tras avanzar el debounce, se llama con { search: <término> }", () => {
    vi.useFakeTimers();
    useQueryMock.mockReturnValue(undefined);
    render(<ClientesScreen />);

    fireEvent.change(getSearchInput(), { target: { value: "Carlos" } });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), { search: "Carlos" });
  });

  it("con datos, renderiza una fila por resultado con el href correcto", () => {
    vi.useFakeTimers();
    useQueryMock.mockReturnValue({
      items: [{ clientId: "c1", name: "Carlos Ruiz", phone: "622334556" }],
      truncated: false,
    });
    render(<ClientesScreen />);

    fireEvent.change(getSearchInput(), { target: { value: "Carlos" } });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    const link = screen.getByRole("link", { name: /Carlos Ruiz/ });
    expect(link.getAttribute("href")).toBe("/clientes/c1");
  });

  it("PRO-12: pinta el badge con el estado de cada cliente", () => {
    vi.useFakeTimers();
    useQueryMock.mockReturnValue({
      items: [{ clientId: "c1", name: "Carlos Ruiz", phone: "622334556", status: "won" }],
      truncated: false,
    });
    render(<ClientesScreen />);

    fireEvent.change(getSearchInput(), { target: { value: "Carlos" } });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText("Venta cerrada")).toBeTruthy();
  });

  it("PRO-12: sin status persistido (cliente legacy), el badge cae a 'Nuevo'", () => {
    vi.useFakeTimers();
    useQueryMock.mockReturnValue({
      items: [{ clientId: "c1", name: "Carlos Ruiz", phone: "622334556" }],
      truncated: false,
    });
    render(<ClientesScreen />);

    fireEvent.change(getSearchInput(), { target: { value: "Carlos" } });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText("Nuevo")).toBeTruthy();
  });
});
