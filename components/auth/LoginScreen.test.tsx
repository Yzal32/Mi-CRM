// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginScreen } from "./LoginScreen";

const loginActionMock = vi.fn();

vi.mock("@/app/login/actions", () => ({
  loginAction: (...args: unknown[]) => loginActionMock(...args),
}));

// Mock parcial: conserva el unstable_rethrow real (necesario para que el
// manejo de redirect() siga funcionando) y solo sustituye useRouter, que
// fuera de un árbol de Next.js real lanzaría al llamarse (mismo criterio
// que HoyScreen.test.tsx).
const routerReplaceMock = vi.fn();
vi.mock("next/navigation", async (importActual) => {
  const actual = await importActual<typeof import("next/navigation")>();
  return { ...actual, useRouter: () => ({ replace: routerReplaceMock, push: vi.fn(), back: vi.fn() }) };
});

// Captura las props exactas que recibe next/link — necesario para el CTA de
// Google (PRO-63): un <a> renderizado no expone `prefetch` como atributo
// del DOM (no es un concepto de HTML), así que comprobar solo el `href`
// no bastaría para verificar que el prefetch está desactivado.
const linkPropsMock = vi.fn();
vi.mock("next/link", () => ({
  default: ({ children, href, prefetch, onClick, className }: Record<string, unknown>) => {
    linkPropsMock({ href, prefetch });
    return (
      <a href={href as string} onClick={onClick as () => void} className={className as string}>
        {children as ReactNode}
      </a>
    );
  },
}));

beforeEach(() => {
  loginActionMock.mockReset();
  linkPropsMock.mockReset();
  routerReplaceMock.mockReset();
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

  it("un rechazo no controlado (p. ej. red caída) libera el cerrojo, muestra el error genérico y permite reintentar", async () => {
    loginActionMock.mockRejectedValueOnce(new Error("fallo de red")).mockResolvedValueOnce(undefined);
    render(<LoginScreen />);

    fillFields();
    clickEntrar();

    const banner = await screen.findByText("No se pudo iniciar sesión. Inténtalo de nuevo.");
    expect(banner.closest("[role='alert']")).not.toBeNull();

    // Si el cerrojo no se hubiera liberado, este segundo click no llegaría
    // a llamar de nuevo a la action.
    clickEntrar();
    await waitFor(() => expect(loginActionMock).toHaveBeenCalledTimes(2));
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

  it("initialErrorCode=ACCOUNT_NOT_PROVISIONED muestra el mensaje correspondiente al montar", () => {
    render(<LoginScreen initialErrorCode="ACCOUNT_NOT_PROVISIONED" />);
    const banner = screen.getByText("Esta cuenta de Google no está autorizada en este CRM.");
    expect(banner.closest("[role='alert']")).not.toBeNull();
  });

  it("sin initialErrorCode no muestra ningún banner de error", () => {
    render(<LoginScreen />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it('el CTA "Continuar con Google" apunta a /api/auth/google/start con prefetch desactivado', () => {
    render(<LoginScreen />);
    const link = screen.getByRole("link", { name: "Continuar con Google" });
    expect(link.getAttribute("href")).toBe("/api/auth/google/start");
    expect(linkPropsMock).toHaveBeenCalledWith({ href: "/api/auth/google/start", prefetch: false });
  });

  it('el enlace "¿Olvidaste tu contraseña?" apunta a /recuperar-contrasena', () => {
    render(<LoginScreen />);
    const link = screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" });
    expect(link.getAttribute("href")).toBe("/recuperar-contrasena");
  });

  it("showPasswordResetToast muestra el toast de confirmación y limpia el query param al montar", () => {
    render(<LoginScreen showPasswordResetToast />);
    expect(screen.getByText("Contraseña actualizada. Inicia sesión con tu contraseña nueva.")).toBeTruthy();
    expect(routerReplaceMock).toHaveBeenCalledWith("/login", { scroll: false });
  });

  it("sin showPasswordResetToast no se muestra el toast", () => {
    render(<LoginScreen />);
    expect(screen.queryByText("Contraseña actualizada. Inicia sesión con tu contraseña nueva.")).toBeNull();
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });
});
