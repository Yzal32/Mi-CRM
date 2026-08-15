// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RestablecerContrasenaScreen } from "./RestablecerContrasenaScreen";

const resetPasswordActionMock = vi.fn();
vi.mock("@/app/restablecer-contrasena/actions", () => ({
  resetPasswordAction: (...args: unknown[]) => resetPasswordActionMock(...args),
}));

beforeEach(() => {
  resetPasswordActionMock.mockReset();
});

afterEach(() => {
  cleanup();
});

function fillFields(email = "marta@ejemplo.com", code = "123456", next = "definitiva456", confirm = "definitiva456") {
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^Código/), { target: { value: code } });
  fireEvent.change(screen.getByLabelText(/^Contraseña nueva/), { target: { value: next } });
  fireEvent.change(screen.getByLabelText(/^Confirmar contraseña nueva/), { target: { value: confirm } });
}

function clickRestablecer() {
  fireEvent.click(screen.getByRole("button", { name: "Restablecer contraseña" }));
}

describe("RestablecerContrasenaScreen", () => {
  it("prellena el email con initialEmail", () => {
    render(<RestablecerContrasenaScreen initialEmail="marta@ejemplo.com" />);
    expect((screen.getByLabelText(/^Email/) as HTMLInputElement).value).toBe("marta@ejemplo.com");
  });

  it("envío correcto llama a resetPasswordAction con email, código y contraseña nueva", async () => {
    resetPasswordActionMock.mockResolvedValue(undefined);
    render(<RestablecerContrasenaScreen />);

    fillFields("marta@ejemplo.com", "123456", "definitiva456", "definitiva456");
    clickRestablecer();

    await waitFor(() =>
      expect(resetPasswordActionMock).toHaveBeenCalledWith({
        email: "marta@ejemplo.com",
        code: "123456",
        newPassword: "definitiva456",
      }),
    );
  });

  it("código con formato inválido (no son 6 dígitos) muestra error local, no llama a resetPasswordAction", async () => {
    render(<RestablecerContrasenaScreen />);

    fillFields("marta@ejemplo.com", "12a45", "definitiva456", "definitiva456");
    clickRestablecer();

    expect(await screen.findByText("El código debe tener 6 dígitos.")).toBeTruthy();
    expect(resetPasswordActionMock).not.toHaveBeenCalled();
  });

  it("confirmación distinta muestra error local, no llama a resetPasswordAction", async () => {
    render(<RestablecerContrasenaScreen />);

    fillFields("marta@ejemplo.com", "123456", "definitiva456", "otra-cosa");
    clickRestablecer();

    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeTruthy();
    expect(resetPasswordActionMock).not.toHaveBeenCalled();
  });

  it("campos vacíos muestran error y no llaman a resetPasswordAction", async () => {
    render(<RestablecerContrasenaScreen />);

    clickRestablecer();

    expect(await screen.findByText("Introduce tu email.")).toBeTruthy();
    expect(resetPasswordActionMock).not.toHaveBeenCalled();
  });

  it("RESET_CODE_INVALID muestra el banner de formulario y un enlace para pedir un código nuevo", async () => {
    resetPasswordActionMock.mockResolvedValue({ error: "RESET_CODE_INVALID" });
    render(<RestablecerContrasenaScreen />);

    fillFields();
    clickRestablecer();

    const banner = await screen.findByText("Código incorrecto o caducado. Solicita uno nuevo.");
    expect(banner.closest("[role='alert']")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Pedir un código nuevo" }).getAttribute("href")).toBe(
      "/recuperar-contrasena",
    );
  });

  it("PASSWORD_TOO_SHORT se muestra junto al campo de la contraseña nueva", async () => {
    resetPasswordActionMock.mockResolvedValue({ error: "PASSWORD_TOO_SHORT" });
    render(<RestablecerContrasenaScreen />);

    fillFields();
    clickRestablecer();

    expect(await screen.findByText("La contraseña debe tener al menos 8 caracteres.")).toBeTruthy();
  });

  it("PASSWORD_RESET_NOT_CONFIGURED muestra el banner genérico", async () => {
    resetPasswordActionMock.mockResolvedValue({ error: "PASSWORD_RESET_NOT_CONFIGURED" });
    render(<RestablecerContrasenaScreen />);

    fillFields();
    clickRestablecer();

    const banner = await screen.findByText("No se pudo restablecer la contraseña. Inténtalo de nuevo.");
    expect(banner.closest("[role='alert']")).not.toBeNull();
  });

  it("un rechazo no controlado (p. ej. red caída) libera el cerrojo, muestra el error genérico y permite reintentar", async () => {
    resetPasswordActionMock.mockRejectedValueOnce(new Error("fallo de red")).mockResolvedValueOnce(undefined);
    render(<RestablecerContrasenaScreen />);

    fillFields();
    clickRestablecer();

    const banner = await screen.findByText("No se pudo restablecer la contraseña. Inténtalo de nuevo.");
    expect(banner.closest("[role='alert']")).not.toBeNull();

    clickRestablecer();
    await waitFor(() => expect(resetPasswordActionMock).toHaveBeenCalledTimes(2));
  });
});
