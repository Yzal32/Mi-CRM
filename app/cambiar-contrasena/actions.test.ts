import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { changePasswordAction } from "./actions";

const mutationMock = vi.fn();
vi.mock("@/lib/convexServer", () => ({
  getConvexServerClient: () => ({ mutation: mutationMock }),
}));

const setSessionCookieMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE_NAME: "session_token",
  setSessionCookie: (...args: unknown[]) => setSessionCookieMock(...args),
}));

const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGetMock }),
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
  cookieGetMock.mockReset();
  redirectMock.mockClear();
});

describe("changePasswordAction", () => {
  it("sin cookie redirige a /login sin llamar a Convex", async () => {
    cookieGetMock.mockReturnValue(undefined);

    await expect(changePasswordAction({ currentPassword: "a", newPassword: "b" })).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("cambio correcto sustituye la cookie por el token rotado y redirige a /", async () => {
    cookieGetMock.mockReturnValue({ value: "a".repeat(64) });
    mutationMock.mockResolvedValue({ token: "b".repeat(64) });

    await expect(
      changePasswordAction({ currentPassword: "temporal123", newPassword: "definitiva456" }),
    ).rejects.toThrow("NEXT_REDIRECT:/");

    expect(setSessionCookieMock).toHaveBeenCalledWith("b".repeat(64));
    expect(setSessionCookieMock).not.toHaveBeenCalledWith("a".repeat(64));
  });

  it("SESSION_INVALID redirige a /login sin fijar cookie", async () => {
    cookieGetMock.mockReturnValue({ value: "a".repeat(64) });
    mutationMock.mockRejectedValue(new ConvexError({ code: "SESSION_INVALID", message: "..." }));

    await expect(changePasswordAction({ currentPassword: "x", newPassword: "y" })).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
    expect(setSessionCookieMock).not.toHaveBeenCalled();
  });

  it("un código de error conocido (p. ej. PASSWORD_UNCHANGED) se devuelve tal cual", async () => {
    cookieGetMock.mockReturnValue({ value: "a".repeat(64) });
    mutationMock.mockRejectedValue(new ConvexError({ code: "PASSWORD_UNCHANGED", message: "..." }));

    const result = await changePasswordAction({ currentPassword: "x", newPassword: "x" });
    expect(result).toEqual({ error: "PASSWORD_UNCHANGED" });
  });

  it("error no reconocido no filtra el detalle interno, devuelve UNKNOWN", async () => {
    cookieGetMock.mockReturnValue({ value: "a".repeat(64) });
    mutationMock.mockRejectedValue(new Error("detalle interno sensible"));

    const result = await changePasswordAction({ currentPassword: "x", newPassword: "y" });
    expect(result).toEqual({ error: "UNKNOWN" });
  });
});
