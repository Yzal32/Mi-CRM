// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { NuevoEmpleadoScreen } from "./NuevoEmpleadoScreen";

const pushMock = vi.fn();
const replaceMock = vi.fn();
const backMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, back: backMock }),
}));

const createEmployeeMock = vi.fn();

vi.mock("@/lib/convex/authedHooks", () => ({
  useAuthedMutation: () => createEmployeeMock,
}));

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: "Carlos Ruiz" } });
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "carlos@ejemplo.com" } });
  fireEvent.change(screen.getByLabelText(/^Contraseña inicial/), { target: { value: "contraseña-segura" } });
}

function clickGuardar() {
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
}

beforeEach(() => {
  pushMock.mockReset();
  replaceMock.mockReset();
  backMock.mockReset();
  createEmployeeMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("NuevoEmpleadoScreen", () => {
  it("envío correcto navega con replace a /ajustes (no push)", async () => {
    createEmployeeMock.mockResolvedValue("user123");
    render(<NuevoEmpleadoScreen />);

    fillRequiredFields();
    clickGuardar();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/ajustes"));
    expect(pushMock).not.toHaveBeenCalled();
    expect(createEmployeeMock).toHaveBeenCalledWith({
      name: "Carlos Ruiz",
      email: "carlos@ejemplo.com",
      password: "contraseña-segura",
    });
  });

  it("doble click no dispara dos mutations", async () => {
    let resolveCreate!: (value: string) => void;
    createEmployeeMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    render(<NuevoEmpleadoScreen />);

    fillRequiredFields();
    const button = screen.getByRole("button", { name: "Guardar" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(createEmployeeMock).toHaveBeenCalledTimes(1);

    resolveCreate("user123");
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/ajustes"));
  });

  it("nombre vacío muestra error de campo y no llama a la mutation", async () => {
    render(<NuevoEmpleadoScreen />);

    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "carlos@ejemplo.com" } });
    fireEvent.change(screen.getByLabelText(/^Contraseña inicial/), { target: { value: "contraseña-segura" } });
    clickGuardar();

    expect(await screen.findByText("Introduce el nombre del empleado.")).toBeTruthy();
    expect(createEmployeeMock).not.toHaveBeenCalled();
  });

  it("email vacío muestra error de campo y no llama a la mutation", async () => {
    render(<NuevoEmpleadoScreen />);

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: "Carlos Ruiz" } });
    fireEvent.change(screen.getByLabelText(/^Contraseña inicial/), { target: { value: "contraseña-segura" } });
    clickGuardar();

    expect(await screen.findByText("Introduce el email del empleado.")).toBeTruthy();
    expect(createEmployeeMock).not.toHaveBeenCalled();
  });

  it("contraseña de menos de 8 caracteres muestra error de campo y no llama a la mutation", async () => {
    render(<NuevoEmpleadoScreen />);

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: "Carlos Ruiz" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "carlos@ejemplo.com" } });
    fireEvent.change(screen.getByLabelText(/^Contraseña inicial/), { target: { value: "corta" } });
    clickGuardar();

    expect(await screen.findByText("La contraseña debe tener al menos 8 caracteres.")).toBeTruthy();
    expect(createEmployeeMock).not.toHaveBeenCalled();
  });

  it("DUPLICATE_EMAIL del servidor marca el campo Email, y editarlo limpia el error", async () => {
    createEmployeeMock.mockRejectedValue(new ConvexError({ code: "DUPLICATE_EMAIL", message: "Ya existe" }));
    render(<NuevoEmpleadoScreen />);

    fillRequiredFields();
    clickGuardar();

    expect(await screen.findByText("Ya hay una cuenta con ese email.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "otro@ejemplo.com" } });
    expect(screen.queryByText("Ya hay una cuenta con ese email.")).toBeNull();
  });

  it("FORBIDDEN del servidor muestra un banner general, no un error de campo", async () => {
    createEmployeeMock.mockRejectedValue(new ConvexError({ code: "FORBIDDEN", message: "No autorizado" }));
    render(<NuevoEmpleadoScreen />);

    fillRequiredFields();
    clickGuardar();

    const banner = await screen.findByText("No se pudo guardar el empleado. Inténtalo de nuevo.");
    expect(banner).toBeTruthy();
    expect(banner.closest("[role='alert']")).not.toBeNull();
  });

  it("fallo de red muestra un banner general y permite reintentar con éxito", async () => {
    createEmployeeMock.mockRejectedValueOnce(new Error("network down"));
    createEmployeeMock.mockResolvedValueOnce("user999");
    render(<NuevoEmpleadoScreen />);

    fillRequiredFields();
    clickGuardar();

    expect(await screen.findByText("No se pudo guardar el empleado. Inténtalo de nuevo.")).toBeTruthy();

    clickGuardar();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/ajustes"));
  });
});
