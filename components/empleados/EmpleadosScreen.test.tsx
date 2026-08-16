// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EmpleadosScreen } from "./EmpleadosScreen";

const useQueryMock = vi.fn();
const mutateMock = vi.fn();

// useAuthedMutation se llama tres veces en el componente (deactivateEmployee,
// reactivateEmployee, changeEmployeeRole) — se mockea con la MISMA función
// para las tres: estos tests no necesitan distinguir qué mutation exacta de
// Convex se habría invocado en producción, solo que se llama con los
// argumentos correctos y en el momento correcto (con/sin confirmación
// previa).
vi.mock("@/lib/convex/authedHooks", () => ({
  useAuthedQuery: (...args: unknown[]) => useQueryMock(...args),
  useAuthedMutation: () => mutateMock,
}));

const activeEmployee = { _id: "user1", name: "Carlos Ruiz", email: "carlos@ejemplo.com", status: "active" as const };
const inactiveEmployee = { _id: "user2", name: "Ana Torres", email: "ana@ejemplo.com", status: "inactive" as const };

beforeEach(() => {
  mutateMock.mockReset();
});

afterEach(() => {
  cleanup();
  useQueryMock.mockReset();
  vi.restoreAllMocks();
});

describe("EmpleadosScreen — carga", () => {
  it("employees === undefined muestra el estado de carga", () => {
    useQueryMock.mockReturnValue(undefined);
    render(<EmpleadosScreen />);
    expect(screen.getByRole("status", { name: "Cargando" })).toBeTruthy();
  });
});

describe("EmpleadosScreen — lista vacía", () => {
  it("muestra EmptyState con acción hacia /empleados/nuevo", () => {
    useQueryMock.mockReturnValue([]);
    render(<EmpleadosScreen />);
    expect(screen.getByText("Aún no tienes empleados")).toBeTruthy();
    const links = screen.getAllByRole("link", { name: /Nuevo empleado/ });
    expect(links.some((link) => link.getAttribute("href") === "/empleados/nuevo")).toBe(true);
  });
});

describe("EmpleadosScreen — listado con empleados", () => {
  it("pinta nombre, email y estado de cada empleado", () => {
    useQueryMock.mockReturnValue([activeEmployee, inactiveEmployee]);
    render(<EmpleadosScreen />);

    expect(screen.getByText("Carlos Ruiz")).toBeTruthy();
    expect(screen.getByText("carlos@ejemplo.com")).toBeTruthy();
    expect(screen.getByText("Activo")).toBeTruthy();

    expect(screen.getByText("Ana Torres")).toBeTruthy();
    expect(screen.getByText("Inactivo")).toBeTruthy();
  });

  it("'Quitar acceso' pide confirmación; si se cancela no llama a la mutation", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    useQueryMock.mockReturnValue([activeEmployee]);
    render(<EmpleadosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Quitar acceso" }));

    expect(window.confirm).toHaveBeenCalledWith(
      "¿Quitar el acceso a Carlos Ruiz? Podrás reactivarlo cuando quieras.",
    );
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("'Quitar acceso' confirmado llama a la mutation con el userId", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mutateMock.mockResolvedValue(null);
    useQueryMock.mockReturnValue([activeEmployee]);
    render(<EmpleadosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Quitar acceso" }));

    await waitFor(() => expect(mutateMock).toHaveBeenCalledWith({ userId: "user1" }));
  });

  it("'Reactivar' NO pide confirmación y llama a la mutation directo", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    mutateMock.mockResolvedValue(null);
    useQueryMock.mockReturnValue([inactiveEmployee]);
    render(<EmpleadosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));

    await waitFor(() => expect(mutateMock).toHaveBeenCalledWith({ userId: "user2" }));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("'Hacer administradora' pide confirmación; si se cancela no llama a la mutation", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    useQueryMock.mockReturnValue([activeEmployee]);
    render(<EmpleadosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Hacer administradora" }));

    expect(window.confirm).toHaveBeenCalledWith(
      "¿Convertir a Carlos Ruiz en Administradora? Tendrá acceso completo, incluida la gestión de empleados.",
    );
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("'Hacer administradora' confirmado llama a la mutation con el userId y role 'owner'", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mutateMock.mockResolvedValue(null);
    useQueryMock.mockReturnValue([activeEmployee]);
    render(<EmpleadosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Hacer administradora" }));

    await waitFor(() => expect(mutateMock).toHaveBeenCalledWith({ userId: "user1", role: "owner" }));
  });

  it("un error al promocionar muestra el mensaje genérico sin romper la pantalla", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mutateMock.mockRejectedValue(new Error("network down"));
    useQueryMock.mockReturnValue([activeEmployee]);
    render(<EmpleadosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Hacer administradora" }));

    const banner = await screen.findByText("No se pudo actualizar el acceso. Inténtalo de nuevo.");
    expect(banner.closest("[role='alert']")).not.toBeNull();
  });

  it("un error de la mutation muestra el mensaje genérico sin romper la pantalla", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mutateMock.mockRejectedValue(new Error("network down"));
    useQueryMock.mockReturnValue([activeEmployee]);
    render(<EmpleadosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Quitar acceso" }));

    const banner = await screen.findByText("No se pudo actualizar el acceso. Inténtalo de nuevo.");
    expect(banner.closest("[role='alert']")).not.toBeNull();
  });
});
