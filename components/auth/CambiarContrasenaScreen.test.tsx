// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CambiarContrasenaScreen } from "./CambiarContrasenaScreen";

const changePasswordActionMock = vi.fn();
vi.mock("@/app/cambiar-contrasena/actions", () => ({
  changePasswordAction: (...args: unknown[]) => changePasswordActionMock(...args),
}));

vi.mock("@/lib/auth/actions", () => ({
  logoutAction: vi.fn(),
}));

beforeEach(() => {
  changePasswordActionMock.mockReset();
});

afterEach(() => {
  cleanup();
});

function fillFields(current = "temporal123", next = "definitiva456", confirm = "definitiva456") {
  fireEvent.change(screen.getByLabelText(/^Contraseña actual/), { target: { value: current } });
  fireEvent.change(screen.getByLabelText(/^Contraseña nueva/), { target: { value: next } });
  fireEvent.change(screen.getByLabelText(/^Confirmar contraseña nueva/), { target: { value: confirm } });
}

function clickGuardar() {
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
}

describe("CambiarContrasenaScreen", () => {
  it("muestra el subtítulo obligatorio cuando mandatory=true", () => {
    render(<CambiarContrasenaScreen mandatory={true} />);
    expect(screen.getByText("Debes actualizar tu contraseña antes de continuar.")).toBeTruthy();
  });

  it("muestra el subtítulo voluntario cuando mandatory=false", () => {
    render(<CambiarContrasenaScreen mandatory={false} />);
    expect(screen.getByText("Cambia tu contraseña cuando quieras.")).toBeTruthy();
  });

  it("envío correcto llama a changePasswordAction con los valores introducidos", async () => {
    changePasswordActionMock.mockResolvedValue(undefined);
    render(<CambiarContrasenaScreen mandatory={true} />);

    fillFields("temporal123", "definitiva456", "definitiva456");
    clickGuardar();

    await waitFor(() =>
      expect(changePasswordActionMock).toHaveBeenCalledWith({
        currentPassword: "temporal123",
        newPassword: "definitiva456",
      }),
    );
  });

  it("confirmación distinta muestra error local, no llama a changePasswordAction", async () => {
    render(<CambiarContrasenaScreen mandatory={true} />);

    fillFields("temporal123", "definitiva456", "otra-cosa");
    clickGuardar();

    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeTruthy();
    expect(changePasswordActionMock).not.toHaveBeenCalled();
  });

  it("confirmación vacía muestra error local, no llama a changePasswordAction", async () => {
    render(<CambiarContrasenaScreen mandatory={true} />);

    fireEvent.change(screen.getByLabelText(/^Contraseña actual/), { target: { value: "temporal123" } });
    fireEvent.change(screen.getByLabelText(/^Contraseña nueva/), { target: { value: "definitiva456" } });
    clickGuardar();

    expect(await screen.findByText("Confirma la contraseña nueva.")).toBeTruthy();
    expect(changePasswordActionMock).not.toHaveBeenCalled();
  });

  it("campos vacíos muestran error y no llaman a changePasswordAction", async () => {
    render(<CambiarContrasenaScreen mandatory={true} />);

    clickGuardar();

    expect(await screen.findByText("Introduce tu contraseña actual.")).toBeTruthy();
    expect(changePasswordActionMock).not.toHaveBeenCalled();
  });

  it("PASSWORD_UNCHANGED se muestra junto al campo de la contraseña nueva", async () => {
    changePasswordActionMock.mockResolvedValue({ error: "PASSWORD_UNCHANGED" });
    render(<CambiarContrasenaScreen mandatory={true} />);

    fillFields();
    clickGuardar();

    expect(await screen.findByText("La nueva contraseña debe ser distinta de la actual.")).toBeTruthy();
  });

  it("CURRENT_PASSWORD_INCORRECT se muestra junto al campo de la contraseña actual", async () => {
    changePasswordActionMock.mockResolvedValue({ error: "CURRENT_PASSWORD_INCORRECT" });
    render(<CambiarContrasenaScreen mandatory={true} />);

    fillFields();
    clickGuardar();

    expect(await screen.findByText("La contraseña actual no es correcta.")).toBeTruthy();
  });

  it("error desconocido muestra el banner genérico con role alert", async () => {
    changePasswordActionMock.mockResolvedValue({ error: "UNKNOWN" });
    render(<CambiarContrasenaScreen mandatory={true} />);

    fillFields();
    clickGuardar();

    const banner = await screen.findByText("No se pudo cambiar la contraseña. Inténtalo de nuevo.");
    expect(banner.closest("[role='alert']")).not.toBeNull();
  });

  it("un rechazo no controlado (p. ej. red caída) libera el cerrojo, muestra el error genérico y permite reintentar", async () => {
    changePasswordActionMock.mockRejectedValueOnce(new Error("fallo de red")).mockResolvedValueOnce(undefined);
    render(<CambiarContrasenaScreen mandatory={true} />);

    fillFields();
    clickGuardar();

    const banner = await screen.findByText("No se pudo cambiar la contraseña. Inténtalo de nuevo.");
    expect(banner.closest("[role='alert']")).not.toBeNull();

    // Si el cerrojo no se hubiera liberado, este segundo click no llegaría
    // a llamar de nuevo a la action.
    clickGuardar();
    await waitFor(() => expect(changePasswordActionMock).toHaveBeenCalledTimes(2));
  });
});
