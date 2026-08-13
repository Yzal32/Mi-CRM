// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MobileTopBar } from "./MobileTopBar";

const backMock = vi.fn();
const pushMock = vi.fn();
let currentPathname = "/estadisticas";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ back: backMock, push: pushMock, replace: vi.fn() }),
}));

const useQueryMock = vi.fn();
const mutationMock = vi.fn();

vi.mock("@/lib/convex/authedHooks", () => ({
  useAuthedQuery: (...args: unknown[]) => useQueryMock(...args),
  useAuthedMutation: () => mutationMock,
}));

afterEach(() => {
  cleanup();
  pushMock.mockClear();
  mutationMock.mockReset();
});

describe("MobileTopBar", () => {
  it('useQuery se llama con "skip" fuera de una ruta de ficha', () => {
    currentPathname = "/estadisticas";
    useQueryMock.mockReturnValue(undefined);
    render(<MobileTopBar />);
    expect(useQueryMock).toHaveBeenLastCalledWith(expect.anything(), "skip");
  });

  it("useQuery se llama con {clientId} real en una ruta de ficha, y no en /clientes/nuevo", () => {
    currentPathname = "/clientes/abc123";
    useQueryMock.mockReturnValue({ name: "Carlos Ruiz" });
    render(<MobileTopBar />);
    expect(useQueryMock).toHaveBeenLastCalledWith(expect.anything(), { clientId: "abc123" });
    expect(screen.getByText("Carlos Ruiz")).toBeTruthy();
  });

  it("/clientes/nuevo no lanza la query de ficha (skip) aunque tenga forma de ruta con id", () => {
    currentPathname = "/clientes/nuevo";
    useQueryMock.mockReturnValue(undefined);
    render(<MobileTopBar />);
    expect(useQueryMock).toHaveBeenLastCalledWith(expect.anything(), "skip");
    expect(screen.getByText("Nuevo cliente")).toBeTruthy();
  });

  it(
    "transición real /clientes/nuevo -> ficha -> pestaña genérica -> otra ficha, sobre la misma instancia, " +
      "sin error de orden de hooks (el hook se llama siempre, mismo sitio, solo cambia \"skip\" vs argumento real)",
    () => {
      currentPathname = "/clientes/nuevo";
      useQueryMock.mockReturnValue(undefined);
      const { rerender } = render(<MobileTopBar />);
      expect(screen.getByText("Nuevo cliente")).toBeTruthy();

      currentPathname = "/clientes/abc123";
      useQueryMock.mockReturnValue({ name: "Carlos Ruiz" });
      rerender(<MobileTopBar />);
      expect(screen.getByText("Carlos Ruiz")).toBeTruthy();

      currentPathname = "/estadisticas";
      useQueryMock.mockReturnValue(undefined);
      rerender(<MobileTopBar />);
      expect(screen.getByText("Estadísticas")).toBeTruthy();

      currentPathname = "/clientes/def456";
      useQueryMock.mockReturnValue({ name: "Ana Torres" });
      rerender(<MobileTopBar />);
      expect(screen.getByText("Ana Torres")).toBeTruthy();

      currentPathname = "/clientes";
      useQueryMock.mockReturnValue(undefined);
      rerender(<MobileTopBar />);
      expect(screen.getByText("Clientes")).toBeTruthy();
    },
  );

  it("el título de la ficha cae a \"Cliente\" mientras la query todavía no ha resuelto", () => {
    currentPathname = "/clientes/abc123";
    useQueryMock.mockReturnValue(undefined);
    render(<MobileTopBar />);
    expect(screen.getByText("Cliente")).toBeTruthy();
  });

  // PRO-19: la pestaña Clientes reutiliza el mismo "+" que ya usa Hoy.
  it('en /clientes aparece el link "Nuevo cliente" hacia /clientes/nuevo', () => {
    currentPathname = "/clientes";
    useQueryMock.mockReturnValue(undefined);
    render(<MobileTopBar />);
    const link = screen.getByRole("link", { name: "Nuevo cliente" });
    expect(link.getAttribute("href")).toBe("/clientes/nuevo");
  });

  it('en / (Hoy) el "+" ya no es un link directo — es un botón que abre un menú (PRO-60)', () => {
    currentPathname = "/";
    useQueryMock.mockReturnValue(undefined);
    render(<MobileTopBar />);
    const button = screen.getByRole("button", { name: "Nueva acción" });
    expect(button.getAttribute("href")).toBeNull();
    expect(screen.queryByRole("link", { name: "Nuevo cliente" })).toBeNull();
  });

  it('en /estadisticas y /ajustes NO aparece el link "Nuevo cliente" (regresión)', () => {
    currentPathname = "/estadisticas";
    useQueryMock.mockReturnValue(undefined);
    const { rerender } = render(<MobileTopBar />);
    expect(screen.queryByRole("link", { name: "Nuevo cliente" })).toBeNull();

    currentPathname = "/ajustes";
    rerender(<MobileTopBar />);
    expect(screen.queryByRole("link", { name: "Nuevo cliente" })).toBeNull();
  });

  it('en /clientes/nuevo NO aparece el botón "+" (ya está en la propia pantalla de alta)', () => {
    currentPathname = "/clientes/nuevo";
    useQueryMock.mockReturnValue(undefined);
    render(<MobileTopBar />);
    expect(screen.queryByRole("link", { name: "Nuevo cliente" })).toBeNull();
  });

  it('en la ficha de un cliente (/clientes/<id>) NO aparece el botón "+"', () => {
    currentPathname = "/clientes/abc123";
    useQueryMock.mockReturnValue({ name: "Carlos Ruiz" });
    render(<MobileTopBar />);
    expect(screen.queryByRole("link", { name: "Nuevo cliente" })).toBeNull();
  });
});

describe("MobileTopBar — menú de accesos rápidos en Hoy (PRO-60)", () => {
  it('pulsar "+" en Hoy abre el menú con las 3 opciones', () => {
    currentPathname = "/";
    useQueryMock.mockReturnValue(undefined);
    render(<MobileTopBar />);

    fireEvent.click(screen.getByRole("button", { name: "Nueva acción" }));

    expect(screen.getByRole("heading", { name: "Nueva acción" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Nuevo cliente/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Registrar venta/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Anotar interacción/ })).toBeTruthy();
  });

  it('elegir "Registrar venta" en el menú lo cierra y abre el selector de cliente', () => {
    currentPathname = "/";
    useQueryMock.mockReturnValue(undefined);
    render(<MobileTopBar />);

    fireEvent.click(screen.getByRole("button", { name: "Nueva acción" }));
    fireEvent.click(screen.getByRole("button", { name: /Registrar venta/ }));

    expect(screen.queryByRole("heading", { name: "Nueva acción" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Registrar venta" })).toBeTruthy();
  });

  it('elegir "Anotar interacción" en el menú lo cierra y abre el selector de cliente', () => {
    currentPathname = "/";
    useQueryMock.mockReturnValue(undefined);
    render(<MobileTopBar />);

    fireEvent.click(screen.getByRole("button", { name: "Nueva acción" }));
    fireEvent.click(screen.getByRole("button", { name: /Anotar interacción/ }));

    expect(screen.queryByRole("heading", { name: "Nueva acción" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Anotar interacción" })).toBeTruthy();
  });

  it('el "+" en Clientes sigue siendo el link directo de siempre, sin menú', () => {
    currentPathname = "/clientes";
    useQueryMock.mockReturnValue(undefined);
    render(<MobileTopBar />);

    expect(screen.queryByRole("button", { name: "Nueva acción" })).toBeNull();
    const link = screen.getByRole("link", { name: "Nuevo cliente" });
    expect(link.getAttribute("href")).toBe("/clientes/nuevo");
  });

  // MobileTopBar no se desmonta al navegar (vive fuera de {children}) — sin
  // el guard `isHoy &&` y el efecto de reseteo, isSheetOpen/flow.state
  // sobreviven un cambio de ruta y el menú o el selector reaparecen encima
  // de una pestaña distinta a la que los abrió.
  it('navegar de Hoy a Clientes con el menú "+" abierto lo cierra, no lo deja persistiendo', () => {
    currentPathname = "/";
    useQueryMock.mockReturnValue(undefined);
    const { rerender } = render(<MobileTopBar />);

    fireEvent.click(screen.getByRole("button", { name: "Nueva acción" }));
    expect(screen.getByRole("heading", { name: "Nueva acción" })).toBeTruthy();

    currentPathname = "/clientes";
    rerender(<MobileTopBar />);

    expect(screen.queryByRole("heading", { name: "Nueva acción" })).toBeNull();
  });

  it('navegar de Hoy a Clientes con el selector de cliente abierto (flujo de venta) lo cierra, no lo deja persistiendo', () => {
    currentPathname = "/";
    useQueryMock.mockReturnValue(undefined);
    const { rerender } = render(<MobileTopBar />);

    fireEvent.click(screen.getByRole("button", { name: "Nueva acción" }));
    fireEvent.click(screen.getByRole("button", { name: /Registrar venta/ }));
    expect(screen.getByRole("heading", { name: "Registrar venta" })).toBeTruthy();

    currentPathname = "/clientes";
    rerender(<MobileTopBar />);

    expect(screen.queryByRole("heading", { name: "Registrar venta" })).toBeNull();
  });

  it("volver a Hoy tras el reseteo no reabre el menú por sí solo (el estado quedó en idle, no oculto)", () => {
    currentPathname = "/";
    useQueryMock.mockReturnValue(undefined);
    const { rerender } = render(<MobileTopBar />);

    fireEvent.click(screen.getByRole("button", { name: "Nueva acción" }));
    currentPathname = "/clientes";
    rerender(<MobileTopBar />);

    currentPathname = "/";
    rerender(<MobileTopBar />);

    expect(screen.queryByRole("heading", { name: "Nueva acción" })).toBeNull();
    expect(screen.getByRole("button", { name: "Nueva acción" })).toBeTruthy();
  });
});
