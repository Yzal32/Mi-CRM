import { beforeEach, describe, expect, it, vi } from "vitest";
import { logoutAction } from "./actions";

const mutationMock = vi.fn();
vi.mock("@/lib/convexServer", () => ({
  getConvexServerClient: () => ({ mutation: mutationMock }),
}));

const clearSessionCookieMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE_NAME: "session_token",
  clearSessionCookie: (...args: unknown[]) => clearSessionCookieMock(...args),
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
  clearSessionCookieMock.mockReset();
  cookieGetMock.mockReset();
  redirectMock.mockClear();
});

describe("logoutAction", () => {
  it("con cookie: cierra la sesión en Convex, borra la cookie y redirige a /login", async () => {
    cookieGetMock.mockReturnValue({ value: "a".repeat(64) });
    mutationMock.mockResolvedValue(null);

    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mutationMock).toHaveBeenCalled();
    expect(clearSessionCookieMock).toHaveBeenCalled();
  });

  it("borra la cookie y redirige aunque Convex falle", async () => {
    cookieGetMock.mockReturnValue({ value: "a".repeat(64) });
    mutationMock.mockRejectedValue(new Error("Convex no responde"));

    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(clearSessionCookieMock).toHaveBeenCalled();
  });

  it("sin cookie: no llama a Convex, igualmente borra la cookie y redirige", async () => {
    cookieGetMock.mockReturnValue(undefined);

    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mutationMock).not.toHaveBeenCalled();
    expect(clearSessionCookieMock).toHaveBeenCalled();
  });
});
