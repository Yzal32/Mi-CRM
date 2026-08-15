// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RecuperarContrasenaScreen } from "./RecuperarContrasenaScreen";

const requestPasswordResetActionMock = vi.fn();
vi.mock("@/app/recuperar-contrasena/actions", () => ({
  requestPasswordResetAction: (...args: unknown[]) => requestPasswordResetActionMock(...args),
}));

// Mock parcial: conserva unstable_rethrow real, solo sustituye useRouter —
// mismo criterio que LoginScreen.test.tsx.
const routerReplaceMock = vi.fn();
vi.mock("next/navigation", async (importActual) => {
  const actual = await importActual<typeof import("next/navigation")>();
  return { ...actual, useRouter: () => ({ replace: routerReplaceMock, push: vi.fn(), back: vi.fn() }) };
});

beforeEach(() => {
  requestPasswordResetActionMock.mockReset();
  routerReplaceMock.mockReset();
});

afterEach(() => {
  cleanup();
});

function clickEnviar() {
  fireEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
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
    const button = screen.getByRole("button", { name: "Enviar enlace" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(requestPasswordResetActionMock).toHaveBeenCalledTimes(1);
    resolveAction(undefined);
  });

  it("showSentToast muestra el toast de confirmación y limpia el query param al montar", () => {
    render(<RecuperarContrasenaScreen showSentToast />);
    expect(
      screen.getByText("Si existe una cuenta con ese email, te hemos enviado un enlace para restablecer tu contraseña."),
    ).toBeTruthy();
    expect(routerReplaceMock).toHaveBeenCalledWith("/recuperar-contrasena", { scroll: false });
  });

  it("sin showSentToast no se muestra el toast", () => {
    render(<RecuperarContrasenaScreen />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });
});
