// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SeleccionarClienteOverlay } from "./SeleccionarClienteOverlay";

const useQueryMock = vi.fn();
vi.mock("@/lib/convex/authedHooks", () => ({
  useAuthedQuery: (...args: unknown[]) => useQueryMock(...args),
}));

const onSelect = vi.fn();
const onClose = vi.fn();

afterEach(() => {
  cleanup();
  useQueryMock.mockReset();
  onSelect.mockReset();
  onClose.mockReset();
  vi.useRealTimers();
});

function getSearchInput() {
  return screen.getByRole("textbox", { name: "Buscar por nombre o teléfono" });
}

function renderOverlay() {
  return render(
    <SeleccionarClienteOverlay title="Registrar venta" today="2026-08-13" onSelect={onSelect} onClose={onClose} />,
  );
}

describe("SeleccionarClienteOverlay — dos hooks siempre montados, skip cruzado", () => {
  it('sin escribir nada, clients.list se llama con {today} real y clients.search con "skip"', () => {
    useQueryMock.mockReturnValue(undefined);
    renderOverlay();
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), "skip");
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ today: "2026-08-13" }));
  });

  it('al escribir, tras el debounce, clients.search se llama con {search, today} y clients.list con "skip"', () => {
    vi.useFakeTimers();
    useQueryMock.mockReturnValue(undefined);
    renderOverlay();

    fireEvent.change(getSearchInput(), { target: { value: "Carlos" } });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), "skip");
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ search: "Carlos", today: "2026-08-13" }));
  });
});

describe("SeleccionarClienteOverlay — título y cierre", () => {
  it("muestra el título recibido por prop", () => {
    useQueryMock.mockReturnValue(undefined);
    renderOverlay();
    expect(screen.getByRole("heading", { name: "Registrar venta" })).toBeTruthy();
  });

  it("el botón de cerrar del overlay llama a onClose", () => {
    useQueryMock.mockReturnValue({ items: [], truncated: false });
    renderOverlay();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("SeleccionarClienteOverlay — estados", () => {
  it("mientras carga, muestra el skeleton", () => {
    useQueryMock.mockReturnValue(undefined);
    renderOverlay();
    expect(screen.getByRole("status", { name: "Cargando" })).toBeTruthy();
  });

  it("sin clientes en absoluto, muestra 'Aún no tienes clientes'", () => {
    useQueryMock.mockReturnValue({ items: [], truncated: false });
    renderOverlay();
    expect(screen.getByText("Aún no tienes clientes")).toBeTruthy();
  });

  it("con término y cero coincidencias, muestra 'Sin resultados'", () => {
    vi.useFakeTimers();
    useQueryMock.mockReturnValue({ items: [], truncated: false });
    renderOverlay();

    fireEvent.change(getSearchInput(), { target: { value: "inexistente" } });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText("Sin resultados")).toBeTruthy();
  });

  it("con truncated, muestra el aviso de que hay más clientes", () => {
    useQueryMock.mockReturnValue({
      items: [{ clientId: "c1", name: "Carlos Ruiz" }],
      truncated: true,
    });
    renderOverlay();
    expect(screen.getByText("Hay más clientes de los que se muestran aquí; afina la búsqueda.")).toBeTruthy();
  });
});

describe("SeleccionarClienteOverlay — filas son botones de selección, no enlaces", () => {
  it("cada resultado se renderiza como role=button, no role=link", () => {
    useQueryMock.mockReturnValue({
      items: [{ clientId: "c1", name: "Carlos Ruiz", phone: "622334556" }],
      truncated: false,
    });
    renderOverlay();

    expect(screen.getByRole("button", { name: /Carlos Ruiz/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Carlos Ruiz/ })).toBeNull();
  });

  it("pulsar una fila llama a onSelect con {clientId, name} y no navega", () => {
    useQueryMock.mockReturnValue({
      items: [{ clientId: "c1", name: "Carlos Ruiz", phone: "622334556" }],
      truncated: false,
    });
    renderOverlay();

    fireEvent.click(screen.getByRole("button", { name: /Carlos Ruiz/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ clientId: "c1", name: "Carlos Ruiz" });
  });
});
