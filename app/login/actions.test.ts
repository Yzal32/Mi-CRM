import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { loginAction } from "./actions";

const mutationMock = vi.fn();
vi.mock("@/lib/convexServer", () => ({
  getConvexServerClient: () => ({ mutation: mutationMock }),
}));

const setSessionCookieMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: (...args: unknown[]) => setSessionCookieMock(...args),
}));

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

beforeEach(() => {
  mutationMock.mockReset();
  setSessionCookieMock.mockReset();
  redirectMock.mockClear();
});

describe("loginAction", () => {
  it("login correcto fija la cookie con el token y redirige a / si no hace falta cambiar contraseña", async () => {
    mutationMock.mockResolvedValue({ token: "a".repeat(64), name: "Marta", role: "owner", mustChangePassword: false });

    await expect(loginAction({ email: "marta@ejemplo.com", password: "x" })).rejects.toThrow("NEXT_REDIRECT:/");

    expect(setSessionCookieMock).toHaveBeenCalledWith("a".repeat(64));
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("login correcto con mustChangePassword redirige a /cambiar-contrasena", async () => {
    mutationMock.mockResolvedValue({ token: "b".repeat(64), name: "Marta", role: "owner", mustChangePassword: true });

    await expect(loginAction({ email: "marta@ejemplo.com", password: "x" })).rejects.toThrow(
      "NEXT_REDIRECT:/cambiar-contrasena",
    );
    expect(redirectMock).toHaveBeenCalledWith("/cambiar-contrasena");
  });

  it("credenciales inválidas no fija cookie ni redirige, devuelve el código de error", async () => {
    mutationMock.mockRejectedValue(
      new ConvexError({ code: "INVALID_CREDENTIALS", message: "Email o contraseña incorrectos." }),
    );

    const result = await loginAction({ email: "marta@ejemplo.com", password: "mal" });

    expect(result).toEqual({ error: "INVALID_CREDENTIALS" });
    expect(setSessionCookieMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("cuenta inactiva devuelve el código correspondiente", async () => {
    mutationMock.mockRejectedValue(
      new ConvexError({ code: "ACCOUNT_INACTIVE", message: "Esta cuenta ya no tiene acceso." }),
    );

    const result = await loginAction({ email: "marta@ejemplo.com", password: "x" });

    expect(result).toEqual({ error: "ACCOUNT_INACTIVE" });
  });

  it("error no reconocido no filtra el mensaje interno, devuelve UNKNOWN", async () => {
    mutationMock.mockRejectedValue(new Error("timeout de red interno, detalle sensible"));

    const result = await loginAction({ email: "marta@ejemplo.com", password: "x" });

    expect(result).toEqual({ error: "UNKNOWN" });
  });
});
