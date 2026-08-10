// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel";
import { EditarClienteOverlay } from "./EditarClienteOverlay";

const mutationMock = vi.fn();

vi.mock("@/lib/convex/authedHooks", () => ({
  useAuthedMutation: () => mutationMock,
}));

const CLIENT_ID = "client1" as Id<"clients">;

beforeEach(() => {
  mutationMock.mockReset();
});

afterEach(() => {
  cleanup();
});

function clickGuardar() {
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
}

describe("EditarClienteOverlay — precarga y guardado parcial", () => {
  it("precarga los datos actuales del cliente", () => {
    render(
      <EditarClienteOverlay
        clientId={CLIENT_ID}
        name="Carlos Ruiz"
        phone="622334556"
        email="carlos@ejemplo.com"
        originChannel="referral"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^Nombre/)).toHaveProperty("value", "Carlos Ruiz");
    expect(screen.getByLabelText("Teléfono")).toHaveProperty("value", "622334556");
    expect(screen.getByLabelText("Email")).toHaveProperty("value", "carlos@ejemplo.com");
    expect(screen.getByLabelText("Canal de origen")).toHaveProperty("value", "referral");
  });

  it("no tocar ningún campo y pulsar Guardar cambios cierra el overlay sin llamar a la mutation", () => {
    const onClose = vi.fn();
    render(<EditarClienteOverlay clientId={CLIENT_ID} name="Carlos Ruiz" phone="622334556" onClose={onClose} />);

    clickGuardar();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("tocar solo el teléfono y guardar envía únicamente ese campo (name/email/originChannel en undefined)", async () => {
    mutationMock.mockResolvedValue(null);
    const onClose = vi.fn();
    render(<EditarClienteOverlay clientId={CLIENT_ID} name="Carlos Ruiz" phone="622334556" onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "699111222" } });
    clickGuardar();

    await waitFor(() =>
      expect(mutationMock).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        name: undefined,
        phone: "699111222",
        email: undefined,
        originChannel: undefined,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("tocar solo el nombre y guardar envía únicamente ese campo (phone/email/originChannel en undefined)", async () => {
    mutationMock.mockResolvedValue(null);
    render(<EditarClienteOverlay clientId={CLIENT_ID} name="Carlos Ruiz" phone="622334556" onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: "Carlos R." } });
    clickGuardar();

    await waitFor(() =>
      expect(mutationMock).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        name: "Carlos R.",
        phone: undefined,
        email: undefined,
        originChannel: undefined,
      }),
    );
  });

  it("borrar el teléfono (tocado) envía phone: '' (borrar), no undefined (no tocar)", async () => {
    mutationMock.mockResolvedValue(null);
    render(
      <EditarClienteOverlay
        clientId={CLIENT_ID}
        name="Carlos Ruiz"
        phone="622334556"
        email="carlos@ejemplo.com"
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "" } });
    clickGuardar();

    await waitFor(() =>
      expect(mutationMock).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        name: undefined,
        phone: "",
        email: undefined,
        originChannel: undefined,
      }),
    );
  });
});

describe("EditarClienteOverlay — inmune a props reactivas", () => {
  it("un campo no tocado nunca se reenvía, ni con su valor original ni con uno nuevo llegado por props mientras el overlay estaba abierto", async () => {
    mutationMock.mockResolvedValue(null);
    const { rerender } = render(
      <EditarClienteOverlay clientId={CLIENT_ID} name="Carlos Ruiz" phone="600111222" onClose={vi.fn()} />,
    );

    // Otra sesión cambia el teléfono mientras el overlay sigue abierto: la
    // reactividad de FichaClienteScreen re-renderiza con una prop `phone`
    // nueva, SIN que el usuario haya tocado el campo teléfono aquí.
    rerender(<EditarClienteOverlay clientId={CLIENT_ID} name="Carlos Ruiz" phone="699999999" onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: "Carlos R." } });
    clickGuardar();

    await waitFor(() =>
      expect(mutationMock).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        name: "Carlos R.",
        phone: undefined,
        email: undefined,
        originChannel: undefined,
      }),
    );
  });
});

describe("EditarClienteOverlay — validación", () => {
  it("nombre vacío (tocado) muestra error de campo y no llama a la mutation", () => {
    render(<EditarClienteOverlay clientId={CLIENT_ID} name="Carlos Ruiz" phone="622334556" onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: "   " } });
    clickGuardar();

    expect(screen.getByText("Introduce el nombre del cliente.")).toBeTruthy();
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("teléfono y email vacíos a la vez (ambos tocados) muestra el banner general, no llama a la mutation", () => {
    render(
      <EditarClienteOverlay
        clientId={CLIENT_ID}
        name="Carlos Ruiz"
        phone="622334556"
        email="carlos@ejemplo.com"
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "" } });
    clickGuardar();

    expect(screen.getByText("Necesitas al menos un teléfono o un email para guardar el cliente.")).toBeTruthy();
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("DUPLICATE_PHONE del servidor marca el campo Teléfono", async () => {
    mutationMock.mockRejectedValue(new ConvexError({ code: "DUPLICATE_PHONE", message: "Ya existe" }));
    render(<EditarClienteOverlay clientId={CLIENT_ID} name="Carlos Ruiz" phone="622334556" onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "699111222" } });
    clickGuardar();

    expect(await screen.findByText("Ya existe un cliente con este teléfono.")).toBeTruthy();
  });
});

describe("EditarClienteOverlay — guardado en vuelo", () => {
  it("doble clic en Guardar cambios solo dispara una mutation", async () => {
    let resolveUpdate!: () => void;
    mutationMock.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolveUpdate = () => resolve(null);
        }),
    );
    render(<EditarClienteOverlay clientId={CLIENT_ID} name="Carlos Ruiz" phone="622334556" onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "699111222" } });
    const button = screen.getByRole("button", { name: "Guardar cambios" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mutationMock).toHaveBeenCalledTimes(1);
    resolveUpdate();
  });

  it("con la mutation pendiente, Escape / backdrop / Cancelar no cierran el overlay; al resolver con éxito, sí se cierra", async () => {
    let resolveUpdate!: () => void;
    mutationMock.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolveUpdate = () => resolve(null);
        }),
    );
    const onClose = vi.fn();
    render(<EditarClienteOverlay clientId={CLIENT_ID} name="Carlos Ruiz" phone="622334556" onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "699111222" } });
    clickGuardar();

    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement as HTMLElement;

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.pointerDown(backdrop);
    fireEvent.pointerUp(backdrop);
    fireEvent.click(backdrop);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).not.toHaveBeenCalled();

    resolveUpdate();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("con la mutation pendiente, los 4 campos quedan deshabilitados", async () => {
    let resolveUpdate!: () => void;
    mutationMock.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolveUpdate = () => resolve(null);
        }),
    );
    render(<EditarClienteOverlay clientId={CLIENT_ID} name="Carlos Ruiz" phone="622334556" onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "699111222" } });
    clickGuardar();

    await waitFor(() => expect(screen.getByLabelText(/^Nombre/)).toHaveProperty("disabled", true));
    expect(screen.getByLabelText("Teléfono")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Email")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Canal de origen")).toHaveProperty("disabled", true);

    resolveUpdate();
  });
});
