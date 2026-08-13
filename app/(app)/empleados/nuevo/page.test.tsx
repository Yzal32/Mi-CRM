// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { getCurrentUser } from "@/lib/auth/currentUser";
import NuevoEmpleadoPage from "./page";

vi.mock("@/lib/auth/currentUser", () => ({ getCurrentUser: vi.fn() }));

// Stub: los detalles de la propia pantalla (formulario, validación,
// mutation) ya están cubiertos en components/empleados/NuevoEmpleadoScreen.test.tsx —
// aquí solo importa qué rama del guard de rol se renderiza.
vi.mock("@/components/empleados/NuevoEmpleadoScreen", () => ({
  NuevoEmpleadoScreen: () => <div data-testid="nuevo-empleado-screen" />,
}));

afterEach(() => {
  cleanup();
});

describe("NuevoEmpleadoPage", () => {
  it("con rol owner, renderiza NuevoEmpleadoScreen", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user1",
      name: "Marta Gómez",
      email: "marta@ejemplo.com",
      role: "owner",
    });

    render(await NuevoEmpleadoPage());

    expect(screen.getByTestId("nuevo-empleado-screen")).toBeTruthy();
    expect(screen.queryByText("No autorizado")).toBeNull();
  });

  it("con rol employee, renderiza la pantalla de no autorizado en vez del formulario", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user2",
      name: "Carlos Ruiz",
      email: "carlos@ejemplo.com",
      role: "employee",
    });

    render(await NuevoEmpleadoPage());

    expect(screen.getByText("No autorizado")).toBeTruthy();
    expect(screen.queryByTestId("nuevo-empleado-screen")).toBeNull();
  });
});
