// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { getCurrentUser } from "@/lib/auth/currentUser";
import EmpleadosPage from "./page";

vi.mock("@/lib/auth/currentUser", () => ({ getCurrentUser: vi.fn() }));

// Stub: los detalles de la propia pantalla (listado, desactivar/reactivar)
// ya están cubiertos en components/empleados/EmpleadosScreen.test.tsx — aquí
// solo importa qué rama del guard de rol se renderiza.
vi.mock("@/components/empleados/EmpleadosScreen", () => ({
  EmpleadosScreen: () => <div data-testid="empleados-screen" />,
}));

afterEach(() => {
  cleanup();
});

describe("EmpleadosPage", () => {
  it("con rol owner, renderiza EmpleadosScreen", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user1",
      name: "Marta Gómez",
      email: "marta@ejemplo.com",
      role: "owner",
    });

    render(await EmpleadosPage());

    expect(screen.getByTestId("empleados-screen")).toBeTruthy();
    expect(screen.queryByText("No autorizado")).toBeNull();
  });

  it("con rol employee, renderiza la pantalla de no autorizado en vez del listado", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user2",
      name: "Carlos Ruiz",
      email: "carlos@ejemplo.com",
      role: "employee",
    });

    render(await EmpleadosPage());

    expect(screen.getByText("No autorizado")).toBeTruthy();
    expect(screen.queryByTestId("empleados-screen")).toBeNull();
  });
});
