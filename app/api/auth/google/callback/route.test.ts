import { NextRequest } from "next/server";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GOOGLE_OAUTH_STATE_COOKIE_NAME } from "@/lib/auth/googleRedirectUri";
import { GET } from "./route";

const actionMock = vi.fn();
vi.mock("@/lib/convexServer", () => ({
  getConvexServerClient: () => ({ action: actionMock }),
}));

const setSessionCookieMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: (...args: unknown[]) => setSessionCookieMock(...args),
}));

const ORIGIN = "https://example.test";
const VALID_STATE = "a".repeat(48);

function makeRequest(options: { code?: string; state?: string; error?: string; stateCookie?: string }): NextRequest {
  const url = new URL(`${ORIGIN}/api/auth/google/callback`);
  if (options.code !== undefined) url.searchParams.set("code", options.code);
  if (options.state !== undefined) url.searchParams.set("state", options.state);
  if (options.error !== undefined) url.searchParams.set("error", options.error);
  const headers: Record<string, string> = {};
  if (options.stateCookie !== undefined) headers.cookie = `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=${options.stateCookie}`;
  return new NextRequest(url, { headers });
}

const originalAppUrl = process.env.APP_URL;

beforeEach(() => {
  actionMock.mockReset();
  setSessionCookieMock.mockReset();
  process.env.APP_URL = ORIGIN;
});

afterEach(() => {
  if (originalAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalAppUrl;
});

describe("GET /api/auth/google/callback — validación de state", () => {
  test("Google devuelve error (consentimiento denegado) -> /login?error=GOOGLE_LOGIN_FAILED, sin llamar a la action", async () => {
    const response = await GET(makeRequest({ error: "access_denied", state: VALID_STATE, stateCookie: VALID_STATE }));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=GOOGLE_LOGIN_FAILED`);
    expect(actionMock).not.toHaveBeenCalled();
  });

  test("sin code -> /login?error=GOOGLE_LOGIN_FAILED, sin llamar a la action", async () => {
    const response = await GET(makeRequest({ state: VALID_STATE, stateCookie: VALID_STATE }));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=GOOGLE_LOGIN_FAILED`);
    expect(actionMock).not.toHaveBeenCalled();
  });

  test("sin cookie de estado -> /login?error=GOOGLE_LOGIN_FAILED, sin llamar a la action", async () => {
    const response = await GET(makeRequest({ code: "abc", state: VALID_STATE }));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=GOOGLE_LOGIN_FAILED`);
    expect(actionMock).not.toHaveBeenCalled();
  });

  test("state del query no coincide con la cookie -> /login?error=GOOGLE_LOGIN_FAILED, sin llamar a la action", async () => {
    const response = await GET(makeRequest({ code: "abc", state: VALID_STATE, stateCookie: "b".repeat(48) }));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=GOOGLE_LOGIN_FAILED`);
    expect(actionMock).not.toHaveBeenCalled();
  });

  test("state inválido limpia igualmente la cookie de estado", async () => {
    const response = await GET(makeRequest({ code: "abc", state: VALID_STATE, stateCookie: "b".repeat(48) }));
    const cookie = response.cookies.get(GOOGLE_OAUTH_STATE_COOKIE_NAME);
    expect(cookie?.value).toBe("");
  });

  test("sin APP_URL -> redirige a /login?error=GOOGLE_LOGIN_FAILED, sin llamar a la action", async () => {
    delete process.env.APP_URL;
    const response = await GET(makeRequest({ code: "abc", state: VALID_STATE, stateCookie: VALID_STATE }));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=GOOGLE_LOGIN_FAILED`);
    expect(actionMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/google/callback — respuestas", () => {
  test("éxito sin mustChangePassword -> fija la cookie de sesión y redirige a /", async () => {
    actionMock.mockResolvedValue({ token: "b".repeat(64), mustChangePassword: false });
    const response = await GET(makeRequest({ code: "abc", state: VALID_STATE, stateCookie: VALID_STATE }));

    expect(setSessionCookieMock).toHaveBeenCalledWith("b".repeat(64));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/`);
    expect(response.cookies.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)?.value).toBe("");
    expect(actionMock).toHaveBeenCalledWith(expect.anything(), { code: "abc", redirectUri: `${ORIGIN}/api/auth/google/callback` });
  });

  test("éxito con mustChangePassword -> redirige a /cambiar-contrasena", async () => {
    actionMock.mockResolvedValue({ token: "b".repeat(64), mustChangePassword: true });
    const response = await GET(makeRequest({ code: "abc", state: VALID_STATE, stateCookie: VALID_STATE }));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/cambiar-contrasena`);
  });

  test("ACCOUNT_NOT_PROVISIONED -> /login?error=ACCOUNT_NOT_PROVISIONED, sin fijar cookie de sesión", async () => {
    actionMock.mockRejectedValue(new ConvexError({ code: "ACCOUNT_NOT_PROVISIONED", message: "..." }));
    const response = await GET(makeRequest({ code: "abc", state: VALID_STATE, stateCookie: VALID_STATE }));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=ACCOUNT_NOT_PROVISIONED`);
    expect(setSessionCookieMock).not.toHaveBeenCalled();
  });

  test("ACCOUNT_INACTIVE -> /login?error=ACCOUNT_INACTIVE", async () => {
    actionMock.mockRejectedValue(new ConvexError({ code: "ACCOUNT_INACTIVE", message: "..." }));
    const response = await GET(makeRequest({ code: "abc", state: VALID_STATE, stateCookie: VALID_STATE }));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=ACCOUNT_INACTIVE`);
  });

  test("error no reconocido no filtra el detalle interno, colapsa a GOOGLE_LOGIN_FAILED", async () => {
    actionMock.mockRejectedValue(new Error("detalle interno sensible"));
    const response = await GET(makeRequest({ code: "abc", state: VALID_STATE, stateCookie: VALID_STATE }));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=GOOGLE_LOGIN_FAILED`);
  });

  // PRO-65: en Railway, el origin que ve la Route Handler dentro del
  // contenedor no es el dominio público — este caso reproduce exactamente
  // ese escenario y habría detectado el bug antes de llegar a producción.
  test("usa APP_URL, no el origin de la petición entrante, tanto para redirectUri como para la redirección de éxito", async () => {
    process.env.APP_URL = "https://mi-crm-production-d80f.up.railway.app";
    actionMock.mockResolvedValue({ token: "b".repeat(64), mustChangePassword: false });

    const url = new URL("http://localhost:8080/api/auth/google/callback");
    url.searchParams.set("code", "abc");
    url.searchParams.set("state", VALID_STATE);
    const request = new NextRequest(url, { headers: { cookie: `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=${VALID_STATE}` } });

    const response = await GET(request);

    expect(actionMock).toHaveBeenCalledWith(expect.anything(), {
      code: "abc",
      redirectUri: "https://mi-crm-production-d80f.up.railway.app/api/auth/google/callback",
    });
    expect(response.headers.get("location")).toBe("https://mi-crm-production-d80f.up.railway.app/");
  });
});

describe("GET /api/auth/google/callback — método", () => {
  test("no exporta POST: el framework de Next.js responde 405 automáticamente a cualquier otro método", async () => {
    const routeModule = await import("./route");
    expect((routeModule as Record<string, unknown>).POST).toBeUndefined();
  });
});
