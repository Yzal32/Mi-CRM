// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginScreen } from "./LoginScreen";

const loginActionMock = vi.fn();

vi.mock("@/app/login/actions", () => ({
  loginAction: (...args: unknown[]) => loginActionMock(...args),
}));

beforeEach(() => {
  loginActionMock.mockReset();
});

afterEach(() => {
  cleanup();
});

function fillFields(email = "marta@ejemplo.com", password = "contraseña-valida") {
  // Regex, no string exacta: ambos campos son `required`, así que su label
  // accesible incluye el sufijo " *" (ver components/ui/Input.tsx) —
  // mismo criterio que NuevoClienteScreen.test.tsx con "Nombre".
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: password } });
}

function clickEntrar() {
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("LoginScreen", () => {
  it("envío correcto llama a loginAction con el email recortado", async () => {
    loginActionMock.mockResolvedValue(undefined);
    render(<LoginScreen />);

    fillFields("  marta@ejemplo.com  ", "contraseña-valida");
    clickEntrar();

    await waitFor(() =>
      expect(loginActionMock).toHaveBeenCalledWith({ email: "marta@ejemplo.com", password: "contraseña-valida" }),
    );
  });

  it("email vacío muestra error de campo y no llama a loginAction", async () => {
    render(<LoginScreen />);

    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: "algo" } });
    clickEntrar();

    expect(await screen.findByText("Introduce tu email.")).toBeTruthy();
    expect(loginActionMock).not.toHaveBeenCalled();
  });

  it("contraseña vacía muestra error de campo y no llama a loginAction", async () => {
    render(<LoginScreen />);

    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "marta@ejemplo.com" } });
    clickEntrar();

    expect(await screen.findByText("Introduce tu contraseña.")).toBeTruthy();
    expect(loginActionMock).not.toHaveBeenCalled();
  });

  it("INVALID_CREDENTIALS muestra el mensaje genérico, en un banner con role alert", async () => {
    loginActionMock.mockResolvedValue({ error: "INVALID_CREDENTIALS" });
    render(<LoginScreen />);

    fillFields();
    clickEntrar();

    const banner = await screen.findByText("Email o contraseña incorrectos.");
    expect(banner.closest("[role='alert']")).not.toBeNull();
  });

  it("ACCOUNT_INACTIVE muestra un mensaje distinto y claro", async () => {
    loginActionMock.mockResolvedValue({ error: "ACCOUNT_INACTIVE" });
    render(<LoginScreen />);

    fillFields();
    clickEntrar();

    expect(await screen.findByText("Esta cuenta ya no tiene acceso.")).toBeTruthy();
  });

  it("error desconocido muestra un mensaje genérico de reintento", async () => {
    loginActionMock.mockResolvedValue({ error: "UNKNOWN" });
    render(<LoginScreen />);

    fillFields();
    clickEntrar();

    expect(await screen.findByText("No se pudo iniciar sesión. Inténtalo de nuevo.")).toBeTruthy();
  });

  it("doble click no llama dos veces a loginAction", async () => {
    let resolveLogin!: (value: undefined) => void;
    loginActionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );
    render(<LoginScreen />);

    fillFields();
    const button = screen.getByRole("button", { name: "Entrar" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(loginActionMock).toHaveBeenCalledTimes(1);
    resolveLogin(undefined);
  });
});
