// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { RegistrarVentaScreen } from "./RegistrarVentaScreen";

const pushMock = vi.fn();
const replaceMock = vi.fn();
const backMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, back: backMock }),
}));

const useQueryMock = vi.fn();
const createSaleMock = vi.fn();

vi.mock("@/lib/convex/authedHooks", () => ({
  useAuthedQuery: (...args: unknown[]) => useQueryMock(...args),
  useAuthedMutation: () => createSaleMock,
}));

const CLIENT = { _id: "client1", name: "Carlos Ruiz" };

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/^Descripción/), { target: { value: "3x Camiseta talla M" } });
  fireEvent.change(screen.getByLabelText(/^Importe/), { target: { value: "45,50" } });
}

function clickGuardar() {
  fireEvent.click(screen.getByRole("button", { name: "Guardar venta" }));
}

beforeEach(() => {
  pushMock.mockReset();
  replaceMock.mockReset();
  backMock.mockReset();
  createSaleMock.mockReset();
  useQueryMock.mockReset();
  useQueryMock.mockReturnValue(CLIENT);
});

afterEach(() => {
  cleanup();
});

describe("RegistrarVentaScreen", () => {
  it("cliente aún sin resolver (undefined) muestra el Skeleton, sin formulario", () => {
    useQueryMock.mockReturnValue(undefined);
    render(<RegistrarVentaScreen clientId="client1" />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByLabelText("Descripción")).toBeNull();
  });

  it("cliente no encontrado (null) muestra el EmptyState, sin formulario", () => {
    useQueryMock.mockReturnValue(null);
    render(<RegistrarVentaScreen clientId="client1" />);

    expect(screen.getByText("Cliente no encontrado")).toBeTruthy();
    expect(screen.queryByLabelText("Descripción")).toBeNull();
  });

  it("muestra el nombre del cliente ya resuelto", () => {
    render(<RegistrarVentaScreen clientId="client1" />);
    expect(screen.getByText("Carlos Ruiz")).toBeTruthy();
  });

  it("envío correcto llama a sales.create con céntimos y navega con replace (no push)", async () => {
    createSaleMock.mockResolvedValue("sale123");
    render(<RegistrarVentaScreen clientId="client1" />);

    fillRequiredFields();
    clickGuardar();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/clientes/client1"));
    expect(pushMock).not.toHaveBeenCalled();
    expect(createSaleMock).toHaveBeenCalledWith({
      clientId: "client1",
      description: "3x Camiseta talla M",
      amountCents: 4550,
    });
  });

  it("doble click no dispara dos mutations", async () => {
    let resolveCreate!: (value: string) => void;
    createSaleMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    render(<RegistrarVentaScreen clientId="client1" />);

    fillRequiredFields();
    const button = screen.getByRole("button", { name: "Guardar venta" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(createSaleMock).toHaveBeenCalledTimes(1);

    resolveCreate("sale123");
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/clientes/client1"));
  });

  it("descripción vacía muestra error de campo y no llama a la mutation", async () => {
    render(<RegistrarVentaScreen clientId="client1" />);

    fireEvent.change(screen.getByLabelText(/^Importe/), { target: { value: "45,50" } });
    clickGuardar();

    expect(await screen.findByText("Describe qué se ha vendido.")).toBeTruthy();
    expect(createSaleMock).not.toHaveBeenCalled();
  });

  it("importe con formato inválido muestra error de campo y no llama a la mutation", async () => {
    render(<RegistrarVentaScreen clientId="client1" />);

    fireEvent.change(screen.getByLabelText(/^Descripción/), { target: { value: "3x Camiseta talla M" } });
    fireEvent.change(screen.getByLabelText(/^Importe/), { target: { value: "1.234,56" } });
    clickGuardar();

    expect(await screen.findByText("Introduce un importe válido.")).toBeTruthy();
    expect(createSaleMock).not.toHaveBeenCalled();
  });

  it("DESCRIPTION_REQUIRED del servidor marca el campo Descripción", async () => {
    createSaleMock.mockRejectedValue(new ConvexError({ code: "DESCRIPTION_REQUIRED", message: "Describe qué se ha vendido." }));
    render(<RegistrarVentaScreen clientId="client1" />);

    fillRequiredFields();
    clickGuardar();

    expect(await screen.findByText("Describe qué se ha vendido.")).toBeTruthy();
  });

  it("DESCRIPTION_TOO_LONG del servidor marca el campo Descripción", async () => {
    createSaleMock.mockRejectedValue(new ConvexError({ code: "DESCRIPTION_TOO_LONG", message: "Demasiado larga" }));
    render(<RegistrarVentaScreen clientId="client1" />);

    fillRequiredFields();
    clickGuardar();

    expect(await screen.findByText("La descripción es demasiado larga.")).toBeTruthy();
  });

  it("INVALID_AMOUNT del servidor marca el campo Importe", async () => {
    createSaleMock.mockRejectedValue(new ConvexError({ code: "INVALID_AMOUNT", message: "Importe inválido" }));
    render(<RegistrarVentaScreen clientId="client1" />);

    fillRequiredFields();
    clickGuardar();

    expect(await screen.findByText("Introduce un importe válido.")).toBeTruthy();
  });

  it("CLIENT_NOT_FOUND del servidor muestra el banner general, no un error de campo", async () => {
    createSaleMock.mockRejectedValue(new ConvexError({ code: "CLIENT_NOT_FOUND", message: "No existe" }));
    render(<RegistrarVentaScreen clientId="client1" />);

    fillRequiredFields();
    clickGuardar();

    const banner = await screen.findByText("Este cliente ya no existe.");
    expect(banner).toBeTruthy();
    expect(banner.closest("[role='alert']")).not.toBeNull();
  });

  it("editar un campo tras el banner general lo limpia (no queda un mensaje obsoleto)", async () => {
    createSaleMock.mockRejectedValue(new ConvexError({ code: "CLIENT_NOT_FOUND", message: "No existe" }));
    render(<RegistrarVentaScreen clientId="client1" />);

    fillRequiredFields();
    clickGuardar();
    expect(await screen.findByText("Este cliente ya no existe.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^Descripción/), { target: { value: "3x Camiseta talla L" } });
    expect(screen.queryByText("Este cliente ya no existe.")).toBeNull();
  });

  it("fallo de red muestra un banner general y permite reintentar con éxito", async () => {
    createSaleMock.mockRejectedValueOnce(new Error("network down"));
    createSaleMock.mockResolvedValueOnce("sale999");
    render(<RegistrarVentaScreen clientId="client1" />);

    fillRequiredFields();
    clickGuardar();

    expect(await screen.findByText("No se pudo guardar la venta. Inténtalo de nuevo.")).toBeTruthy();

    clickGuardar();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/clientes/client1"));
  });

  it("Cancelar vuelve atrás sin llamar a la mutation", () => {
    render(<RegistrarVentaScreen clientId="client1" />);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(backMock).toHaveBeenCalledTimes(1);
    expect(createSaleMock).not.toHaveBeenCalled();
  });
});
