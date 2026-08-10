import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { proxy } from "./proxy";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

function makeRequest(path: string, cookieValue?: string): NextRequest {
  const headers = cookieValue ? { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` } : undefined;
  return new NextRequest(`https://example.test${path}`, { headers });
}

describe("proxy", () => {
  test("sin cookie y ruta protegida -> redirige a /login", () => {
    const response = proxy(makeRequest("/clientes"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/login");
  });

  test("sin cookie y /login -> deja pasar (no redirige)", () => {
    const response = proxy(makeRequest("/login"));
    expect(response.headers.get("location")).toBeNull();
  });

  test("con cookie y cualquier ruta -> deja pasar", () => {
    const response = proxy(makeRequest("/clientes", "abc123"));
    expect(response.headers.get("location")).toBeNull();
  });

  test("con cookie en la raíz -> deja pasar", () => {
    const response = proxy(makeRequest("/", "abc123"));
    expect(response.headers.get("location")).toBeNull();
  });

  // PRO-59: sin esta exclusión, una petición sin cookie a este endpoint
  // recibiría una redirección HTML a /login en vez de llegar al Route
  // Handler, que necesita poder responder su propio 401 JSON ({error:
  // "NO_SESSION"}) — ver app/api/auth/convex-token/route.ts.
  test("sin cookie y /api/auth/convex-token -> deja pasar (no redirige)", () => {
    const response = proxy(makeRequest("/api/auth/convex-token"));
    expect(response.headers.get("location")).toBeNull();
  });
});
