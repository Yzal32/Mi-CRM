// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MobileTopBar } from "./MobileTopBar";

const backMock = vi.fn();
let currentPathname = "/estadisticas";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ back: backMock, push: vi.fn(), replace: vi.fn() }),
}));

const useQueryMock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

afterEach(() => {
  cleanup();
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
});
