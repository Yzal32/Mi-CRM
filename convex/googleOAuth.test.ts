import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { exchangeGoogleCodeForEmail, verifiedEmailFromGoogleUserinfo } from "./model/googleOAuth";

type CodeErrorData = { code: string; message: string };

async function captureError(promise: Promise<unknown>): Promise<ConvexError<CodeErrorData>> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ConvexError) return error as ConvexError<CodeErrorData>;
    throw error;
  }
  throw new Error("se esperaba que la promesa fallara");
}

describe("verifiedEmailFromGoogleUserinfo", () => {
  test("email_verified true y email string -> devuelve el email", () => {
    expect(verifiedEmailFromGoogleUserinfo({ email: "marta@ejemplo.com", email_verified: true })).toBe("marta@ejemplo.com");
  });

  test("email_verified false -> GOOGLE_LOGIN_FAILED", async () => {
    const error = await captureError(
      Promise.resolve().then(() => verifiedEmailFromGoogleUserinfo({ email: "marta@ejemplo.com", email_verified: false })),
    );
    expect(error.data.code).toBe("GOOGLE_LOGIN_FAILED");
  });

  test("sin email_verified -> GOOGLE_LOGIN_FAILED", async () => {
    const error = await captureError(Promise.resolve().then(() => verifiedEmailFromGoogleUserinfo({ email: "marta@ejemplo.com" })));
    expect(error.data.code).toBe("GOOGLE_LOGIN_FAILED");
  });

  test("email ausente -> GOOGLE_LOGIN_FAILED", async () => {
    const error = await captureError(Promise.resolve().then(() => verifiedEmailFromGoogleUserinfo({ email_verified: true })));
    expect(error.data.code).toBe("GOOGLE_LOGIN_FAILED");
  });

  test("email no es string -> GOOGLE_LOGIN_FAILED", async () => {
    const error = await captureError(
      Promise.resolve().then(() => verifiedEmailFromGoogleUserinfo({ email: 12345, email_verified: true })),
    );
    expect(error.data.code).toBe("GOOGLE_LOGIN_FAILED");
  });
});

const ARGS = { code: "auth-code", redirectUri: "https://example.test/api/auth/google/callback", clientId: "id", clientSecret: "secret" };

describe("exchangeGoogleCodeForEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("intercambio y userinfo correctos -> devuelve el email verificado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "tok" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: "marta@ejemplo.com", email_verified: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const email = await exchangeGoogleCodeForEmail(ARGS);
    expect(email).toBe("marta@ejemplo.com");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [tokenUrl] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe("https://oauth2.googleapis.com/token");
    const [userinfoUrl, userinfoInit] = fetchMock.mock.calls[1];
    expect(userinfoUrl).toBe("https://openidconnect.googleapis.com/v1/userinfo");
    expect((userinfoInit as RequestInit).headers).toEqual({ Authorization: "Bearer tok" });
  });

  test("el endpoint de token responde con error -> GOOGLE_LOGIN_FAILED, no llega a llamar a userinfo", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("invalid_grant", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await captureError(exchangeGoogleCodeForEmail(ARGS));
    expect(error.data.code).toBe("GOOGLE_LOGIN_FAILED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("el endpoint de token no devuelve access_token -> GOOGLE_LOGIN_FAILED", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await captureError(exchangeGoogleCodeForEmail(ARGS));
    expect(error.data.code).toBe("GOOGLE_LOGIN_FAILED");
  });

  test("el endpoint userinfo responde con error -> GOOGLE_LOGIN_FAILED", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "tok" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await captureError(exchangeGoogleCodeForEmail(ARGS));
    expect(error.data.code).toBe("GOOGLE_LOGIN_FAILED");
  });

  test("userinfo responde sin email_verified -> GOOGLE_LOGIN_FAILED", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "tok" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: "marta@ejemplo.com" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await captureError(exchangeGoogleCodeForEmail(ARGS));
    expect(error.data.code).toBe("GOOGLE_LOGIN_FAILED");
  });
});
