import { NextRequest } from "next/server";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import * as routeModule from "./route";

const mutationMock = vi.fn();
vi.mock("@/lib/convexServer", () => ({
  getConvexServerClient: () => ({ mutation: mutationMock }),
}));

const clearSessionCookieMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE_NAME: "session_token",
  clearSessionCookie: (...args: unknown[]) => clearSessionCookieMock(...args),
}));

const ORIGIN = "https://example.test";

function makeRequest(options: {
  cookie?: string;
  secFetchSite?: string;
  origin?: string;
}): NextRequest {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.cookie = `${SESSION_COOKIE_NAME}=${options.cookie}`;
  if (options.secFetchSite !== undefined) headers["sec-fetch-site"] = options.secFetchSite;
  if (options.origin !== undefined) headers.origin = options.origin;
  return new NextRequest(`${ORIGIN}/api/auth/convex-token`, { method: "POST", headers });
}

beforeEach(() => {
  mutationMock.mockReset();
  clearSessionCookieMock.mockReset();
});

describe("POST /api/auth/convex-token — validación de origen (fail-closed)", () => {
  test("Sec-Fetch-Site: cross-site -> 403, incluso con un Origin correcto adjunto", async () => {
    const response = await routeModule.POST(makeRequest({ secFetchSite: "cross-site", origin: ORIGIN, cookie: "a".repeat(64) }));
    expect(response.status).toBe(403);
    expect(mutationMock).not.toHaveBeenCalled();
  });

  test("Sec-Fetch-Site: same-origin -> pasa la validación de origen", async () => {
    mutationMock.mockResolvedValue({ accessToken: "b".repeat(64), expiresAt: 1000, serverNow: 0 });
    const response = await routeModule.POST(makeRequest({ secFetchSite: "same-origin", cookie: "a".repeat(64) }));
    expect(response.status).toBe(200);
  });

  test("sin Sec-Fetch-Site, con Origin igual al del propio deployment -> pasa", async () => {
    mutationMock.mockResolvedValue({ accessToken: "b".repeat(64), expiresAt: 1000, serverNow: 0 });
    const response = await routeModule.POST(makeRequest({ origin: ORIGIN, cookie: "a".repeat(64) }));
    expect(response.status).toBe(200);
  });

  test("sin Sec-Fetch-Site, con Origin distinto -> 403", async () => {
    const response = await routeModule.POST(makeRequest({ origin: "https://evil.test", cookie: "a".repeat(64) }));
    expect(response.status).toBe(403);
    expect(mutationMock).not.toHaveBeenCalled();
  });

  test("sin Sec-Fetch-Site y sin Origin -> 403 (nunca se deja pasar por falta de información)", async () => {
    const response = await routeModule.POST(makeRequest({ cookie: "a".repeat(64) }));
    expect(response.status).toBe(403);
    expect(mutationMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/convex-token — respuestas", () => {
  test("sin cookie -> 401 NO_SESSION", async () => {
    const response = await routeModule.POST(makeRequest({ secFetchSite: "same-origin" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "NO_SESSION" });
    expect(mutationMock).not.toHaveBeenCalled();
  });

  test("éxito -> 200 con token/expiresAt/serverNow tal cual los devuelve la mutation", async () => {
    mutationMock.mockResolvedValue({ accessToken: "b".repeat(64), expiresAt: 5000, serverNow: 1000 });
    const response = await routeModule.POST(makeRequest({ secFetchSite: "same-origin", cookie: "a".repeat(64) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: "b".repeat(64), expiresAt: 5000, serverNow: 1000 });
  });

  test("SESSION_INVALID -> borra la cookie httpOnly y responde 401", async () => {
    mutationMock.mockRejectedValue(new ConvexError({ code: "SESSION_INVALID", message: "..." }));
    const response = await routeModule.POST(makeRequest({ secFetchSite: "same-origin", cookie: "a".repeat(64) }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "SESSION_INVALID" });
    expect(clearSessionCookieMock).toHaveBeenCalledTimes(1);
  });

  test("PASSWORD_CHANGE_REQUIRED -> 403 sin tocar la cookie", async () => {
    mutationMock.mockRejectedValue(new ConvexError({ code: "PASSWORD_CHANGE_REQUIRED", message: "..." }));
    const response = await routeModule.POST(makeRequest({ secFetchSite: "same-origin", cookie: "a".repeat(64) }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "PASSWORD_CHANGE_REQUIRED" });
    expect(clearSessionCookieMock).not.toHaveBeenCalled();
  });

  test("error no reconocido no filtra el detalle interno, devuelve 500 UNKNOWN", async () => {
    mutationMock.mockRejectedValue(new Error("detalle interno sensible"));
    const response = await routeModule.POST(makeRequest({ secFetchSite: "same-origin", cookie: "a".repeat(64) }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "UNKNOWN" });
  });

  test("Cache-Control: private, no-store está presente en los 4 casos de respuesta", async () => {
    const cases = [
      { setup: () => {}, request: makeRequest({ secFetchSite: "cross-site" }) }, // 403
      { setup: () => {}, request: makeRequest({ secFetchSite: "same-origin" }) }, // 401 NO_SESSION
      {
        setup: () => mutationMock.mockRejectedValue(new ConvexError({ code: "PASSWORD_CHANGE_REQUIRED", message: "..." })),
        request: makeRequest({ secFetchSite: "same-origin", cookie: "a".repeat(64) }), // 403
      },
      {
        setup: () => mutationMock.mockResolvedValue({ accessToken: "b".repeat(64), expiresAt: 5000, serverNow: 1000 }),
        request: makeRequest({ secFetchSite: "same-origin", cookie: "a".repeat(64) }), // 200
      },
    ];
    for (const { setup, request } of cases) {
      mutationMock.mockReset();
      setup();
      const response = await routeModule.POST(request);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
  });
});

describe("POST /api/auth/convex-token — método", () => {
  test("no exporta GET: el framework de Next.js responde 405 automáticamente a cualquier otro método", () => {
    expect((routeModule as Record<string, unknown>).GET).toBeUndefined();
  });
});
