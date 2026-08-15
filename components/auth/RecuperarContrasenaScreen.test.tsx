// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RecuperarContrasenaScreen } from "./RecuperarContrasenaScreen";

const requestPasswordResetActionMock = vi.fn();
vi.mock("@/app/recuperar-contrasena/actions", () => ({
  requestPasswordResetAction: (...args: unknown[]) => requestPasswordResetActionMock(...args),
}));

beforeEach(() => {
  requestPasswordResetActionMock.mockReset();
});

afterEach(() => {
  cleanup();
});

function clickEnviar() {
  fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
}

describe("RecuperarContrasenaScreen", () => {
  it("envío correcto llama a requestPasswordResetAction con el email recortado", async () => {
    requestPasswordResetActionMock.mockResolvedValue(undefined);
    render(<RecuperarContrasenaScreen />);

    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "  marta@ejemplo.com  " } });
    clickEnviar();

    await waitFor(() => expect(requestPasswordResetActionMock).toHaveBeenCalledWith({ email: "marta@ejemplo.com" }));
  });

  it("email vacío muestra error de campo y no llama a la action", async () => {
    render(<RecuperarContrasenaScreen />);
    clickEnviar();

    expect(await screen.findByText("Introduce tu email.")).toBeTruthy();
    expect(requestPasswordResetActionMock).not.toHaveBeenCalled();
  });

  it("un rechazo no controlado (p. ej. red caída) libera el cerrojo, muestra el error genérico y permite reintentar", async () => {
    requestPasswordResetActionMock.mockRejectedValueOnce(new Error("fallo de red")).mockResolvedValueOnce(undefined);
    render(<RecuperarContrasenaScreen />);

    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "marta@ejemplo.com" } });
    clickEnviar();

    const banner = await screen.findByText("No se pudo procesar la solicitud. Inténtalo de nuevo.");
    expect(banner.closest("[role='alert']")).not.toBeNull();

    clickEnviar();
    await waitFor(() => expect(requestPasswordResetActionMock).toHaveBeenCalledTimes(2));
  });

  it("doble click no llama dos veces a la action", async () => {
    let resolveAction!: (value: undefined) => void;
    requestPasswordResetActionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );
    render(<RecuperarContrasenaScreen />);

    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "marta@ejemplo.com" } });
    const button = screen.getByRole("button", { name: "Enviar código" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(requestPasswordResetActionMock).toHaveBeenCalledTimes(1);
    resolveAction(undefined);
  });
});
