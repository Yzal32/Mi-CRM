import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { GOOGLE_OAUTH_STATE_COOKIE_NAME } from "@/lib/auth/googleRedirectUri";
import { GET } from "./route";

const ORIGIN = "https://example.test";

function makeRequest(): NextRequest {
  return new NextRequest(`${ORIGIN}/api/auth/google/start`);
}

const originalClientId = process.env.GOOGLE_CLIENT_ID;

beforeEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
});

afterEach(() => {
  if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = originalClientId;
});

describe("GET /api/auth/google/start", () => {
  test("sin GOOGLE_CLIENT_ID -> redirige a /login?error=GOOGLE_LOGIN_FAILED, sin fijar cookie", async () => {
    const response = await GET(makeRequest());
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=GOOGLE_LOGIN_FAILED`);
    expect(response.cookies.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)).toBeUndefined();
  });

  test("con GOOGLE_CLIENT_ID -> redirige a la URL de autorización de Google con los parámetros correctos", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-123";
    const response = await GET(makeRequest());

    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    const url = new URL(location!);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/google/callback`);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email");
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("state")).toMatch(/^[0-9a-f]{48}$/);
  });

  test("fija la cookie de estado httpOnly con el mismo valor que el parámetro state, acotada a /api/auth/google", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-123";
    const response = await GET(makeRequest());

    const location = new URL(response.headers.get("location")!);
    const stateParam = location.searchParams.get("state");
    const cookie = response.cookies.get(GOOGLE_OAUTH_STATE_COOKIE_NAME);
    expect(cookie?.value).toBe(stateParam);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/api/auth/google");
    expect(cookie?.sameSite).toBe("lax");
  });

  test("dos peticiones generan valores de state distintos", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-123";
    const first = new URL((await GET(makeRequest())).headers.get("location")!);
    const second = new URL((await GET(makeRequest())).headers.get("location")!);
    expect(first.searchParams.get("state")).not.toBe(second.searchParams.get("state"));
  });
});
