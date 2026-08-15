import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { resetPasswordAction } from "./actions";

const mutationMock = vi.fn();
vi.mock("@/lib/convexServer", () => ({
  getConvexServerClient: () => ({ mutation: mutationMock }),
}));

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

beforeEach(() => {
  mutationMock.mockReset();
  redirectMock.mockClear();
});

describe("resetPasswordAction", () => {
  it("restablecimiento correcto redirige a /login?passwordReset=1 (sin cookie que fijar)", async () => {
    mutationMock.mockResolvedValue(null);

    await expect(resetPasswordAction({ token: "a".repeat(64), newPassword: "nuevaPass123" })).rejects.toThrow(
      "NEXT_REDIRECT:/login?passwordReset=1",
    );
  });

  it("token inválido/caducado devuelve el código, sin redirigir", async () => {
    mutationMock.mockRejectedValue(new ConvexError({ code: "RESET_TOKEN_INVALID", message: "..." }));

    const result = await resetPasswordAction({ token: "a".repeat(64), newPassword: "nuevaPass123" });

    expect(result).toEqual({ error: "RESET_TOKEN_INVALID" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("contraseña demasiado corta devuelve el código correspondiente", async () => {
    mutationMock.mockRejectedValue(new ConvexError({ code: "PASSWORD_TOO_SHORT", message: "..." }));

    const result = await resetPasswordAction({ token: "a".repeat(64), newPassword: "corta" });

    expect(result).toEqual({ error: "PASSWORD_TOO_SHORT" });
  });

  it("error no reconocido no filtra el mensaje interno, devuelve UNKNOWN", async () => {
    mutationMock.mockRejectedValue(new Error("detalle interno sensible"));

    const result = await resetPasswordAction({ token: "a".repeat(64), newPassword: "nuevaPass123" });

    expect(result).toEqual({ error: "UNKNOWN" });
  });
});
