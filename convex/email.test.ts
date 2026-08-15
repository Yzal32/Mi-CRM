import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { sendEmail } from "./model/email";

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

const ARGS = { apiKey: "re_test_key", from: "Mi CRM <onboarding@resend.dev>", to: "marta@ejemplo.com", subject: "Asunto", html: "<p>Cuerpo</p>" };

describe("sendEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("Resend responde ok -> no lanza y envía la petición esperada", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: "email-id" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendEmail(ARGS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toEqual({
      Authorization: "Bearer re_test_key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      from: ARGS.from,
      to: ARGS.to,
      subject: ARGS.subject,
      html: ARGS.html,
    });
  });

  test("Resend responde con error -> SEND_EMAIL_FAILED", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("invalid request", { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await captureError(sendEmail(ARGS));
    expect(error.data.code).toBe("SEND_EMAIL_FAILED");
  });
});
