// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { NuevoClienteScreen } from "./NuevoClienteScreen";

const pushMock = vi.fn();
const replaceMock = vi.fn();
const backMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, back: backMock }),
}));

const createClientMock = vi.fn();

vi.mock("@/lib/convex/authedHooks", () => ({
  useAuthedMutation: () => createClientMock,
}));

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: "Carlos Ruiz" } });
  fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "622334556" } });
}

function clickGuardar() {
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
}

beforeEach(() => {
  pushMock.mockReset();
  replaceMock.mockReset();
  backMock.mockReset();
  createClientMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("NuevoClienteScreen", () => {
  it("envío correcto navega con replace (no push)", async () => {
    createClientMock.mockResolvedValue("client123");
    render(<NuevoClienteScreen />);

    fillRequiredFields();
    clickGuardar();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/clientes/client123"));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("doble click no dispara dos mutations", async () => {
    let resolveCreate!: (value: string) => void;
    createClientMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    render(<NuevoClienteScreen />);

    fillRequiredFields();
    // Mismo nodo para los dos clicks: tras el primero el texto cambia a
    // "Guardando…", así que re-buscar por nombre "Guardar" ya no lo encontraría.
    const button = screen.getByRole("button", { name: "Guardar" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(createClientMock).toHaveBeenCalledTimes(1);

    resolveCreate("client123");
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/clientes/client123"));
  });

  it("nombre vacío muestra error de campo y no llama a la mutation", async () => {
    render(<NuevoClienteScreen />);

    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "622334556" } });
    clickGuardar();

    expect(await screen.findByText("Introduce el nombre del cliente.")).toBeTruthy();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("sin teléfono ni email muestra el banner general, no un error de campo", async () => {
    render(<NuevoClienteScreen />);

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: "Cliente" } });
    clickGuardar();

    const banner = await screen.findByText("Necesitas al menos un teléfono o un email para guardar el cliente.");
    expect(banner).toBeTruthy();
    expect(banner.closest("[role='alert']")).not.toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("error de validación local no bloquea: corregir y guardar funciona", async () => {
    createClientMock.mockResolvedValue("client1");
    render(<NuevoClienteScreen />);

    clickGuardar();
    expect(await screen.findByText("Introduce el nombre del cliente.")).toBeTruthy();

    fillRequiredFields();
    clickGuardar();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/clientes/client1"));
  });

  it("DUPLICATE_PHONE del servidor marca el campo Teléfono, y editarlo limpia el error", async () => {
    createClientMock.mockRejectedValue(new ConvexError({ code: "DUPLICATE_PHONE", message: "Ya existe" }));
    render(<NuevoClienteScreen />);

    fillRequiredFields();
    clickGuardar();

    expect(await screen.findByText("Ya existe un cliente con este teléfono.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "622334557" } });
    expect(screen.queryByText("Ya existe un cliente con este teléfono.")).toBeNull();
  });

  it("fallo de red muestra un banner general y permite reintentar con éxito", async () => {
    createClientMock.mockRejectedValueOnce(new Error("network down"));
    createClientMock.mockResolvedValueOnce("client999");
    render(<NuevoClienteScreen />);

    fillRequiredFields();
    clickGuardar();

    expect(await screen.findByText("No se pudo guardar el cliente. Inténtalo de nuevo.")).toBeTruthy();

    clickGuardar();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/clientes/client999"));
  });
});
