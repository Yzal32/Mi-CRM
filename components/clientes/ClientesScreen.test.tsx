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

describe("ClientesScreen — dos hooks siempre montados, skip cruzado (PRO-19)", () => {
  it('sin escribir nada, clients.list se llama con {today} real y clients.search con "skip"', () => {
    useQueryMock.mockReturnValue(undefined);
    render(<ClientesScreen />);
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), "skip");
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ today: expect.any(String) }));
  });

  it('al escribir, tras el debounce, clients.search se llama con {search, today} y clients.list con "skip"', () => {
    vi.useFakeTimers();
    useQueryMock.mockReturnValue(undefined);
    render(<ClientesScreen />);

    fireEvent.change(getSearchInput(), { target: { value: "Carlos" } });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), "skip");
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ search: "Carlos", today: expect.any(String) }));
  });
});

describe("ClientesScreen — header de escritorio", () => {
  it('siempre muestra el link "Nuevo cliente" hacia /clientes/nuevo', () => {
    useQueryMock.mockReturnValue(undefined);
    render(<ClientesScreen />);
    const link = screen.getByRole("link", { name: /Nuevo cliente/ });
    expect(link.getAttribute("href")).toBe("/clientes/nuevo");
  });
});

describe("ClientesScreen — listado por defecto (sin término)", () => {
  it("sin escribir nada, con clientes, renderiza una fila por cliente con el href correcto", () => {
    useQueryMock.mockReturnValue({
      items: [{ clientId: "c1", name: "Carlos Ruiz", phone: "622334556" }],
      truncated: false,
    });
    render(<ClientesScreen />);

    const link = screen.getByRole("link", { name: /Carlos Ruiz/ });
    expect(link.getAttribute("href")).toBe("/clientes/c1");
  });

  it("sin clientes en absoluto, muestra 'Aún no tienes clientes' con acción a /clientes/nuevo", () => {
    useQueryMock.mockReturnValue({ items: [], truncated: false });
    render(<ClientesScreen />);

    expect(screen.getByText("Aún no tienes clientes")).toBeTruthy();
    const links = screen.getAllByRole("link", { name: /Nuevo cliente|Añadir cliente/ });
    expect(links.some((link) => link.getAttribute("href") === "/clientes/nuevo")).toBe(true);
  });

  it("contador muestra el número de clientes, y con truncated el signo +", () => {
    useQueryMock.mockReturnValue({
      items: [{ clientId: "c1", name: "Ana" }, { clientId: "c2", name: "Bea" }],
      truncated: true,
    });
    render(<ClientesScreen />);
    expect(screen.getByText("2+ clientes")).toBeTruthy();
  });
});

describe("ClientesScreen — búsqueda con debounce", () => {
  it("con término y cero coincidencias, muestra 'Sin resultados'", () => {
    vi.useFakeTimers();
    useQueryMock.mockReturnValue({ items: [], truncated: false });
    render(<ClientesScreen />);

    fireEvent.change(getSearchInput(), { target: { value: "inexistente" } });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText("Sin resultados")).toBeTruthy();
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

  it("contador muestra 'N resultados' con término, y con truncated el signo +", () => {
    vi.useFakeTimers();
    useQueryMock.mockReturnValue({
      items: [{ clientId: "c1", name: "Carlos Ruiz" }],
      truncated: true,
    });
    render(<ClientesScreen />);

    fireEvent.change(getSearchInput(), { target: { value: "Carlos" } });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText("1+ resultados")).toBeTruthy();
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

describe("ClientesScreen — aviso de seguimiento pendiente (PRO-19)", () => {
  it("una fila con followUp pinta el icono y el texto (atrasado)", () => {
    useQueryMock.mockReturnValue({
      items: [{ clientId: "c1", name: "Carlos Ruiz", followUp: { actionType: "call", diffDays: 3 } }],
      truncated: false,
    });
    render(<ClientesScreen />);
    expect(screen.getByText("Llamar · hace 3 días")).toBeTruthy();
  });

  it("una fila con followUp de hoy pinta el texto 'hoy'", () => {
    useQueryMock.mockReturnValue({
      items: [{ clientId: "c1", name: "Carlos Ruiz", followUp: { actionType: "whatsapp", diffDays: 0 } }],
      truncated: false,
    });
    render(<ClientesScreen />);
    expect(screen.getByText("WhatsApp · hoy")).toBeTruthy();
  });

  it("una fila con followUp futuro pinta el texto en días positivos", () => {
    useQueryMock.mockReturnValue({
      items: [{ clientId: "c1", name: "Carlos Ruiz", followUp: { actionType: "email", diffDays: -3 } }],
      truncated: false,
    });
    render(<ClientesScreen />);
    expect(screen.getByText("Email · en 3 días")).toBeTruthy();
  });

  it("una fila sin followUp no pinta ninguna línea de seguimiento", () => {
    useQueryMock.mockReturnValue({
      items: [{ clientId: "c1", name: "Carlos Ruiz" }],
      truncated: false,
    });
    render(<ClientesScreen />);
    expect(screen.queryByText(/hace \d+ días|hoy|mañana|en \d+ días/)).toBeNull();
  });
});
