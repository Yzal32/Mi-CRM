import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { resetPasswordAction } from "./actions";

const actionMock = vi.fn();
vi.mock("@/lib/convexServer", () => ({
  getConvexServerClient: () => ({ action: actionMock }),
}));

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

beforeEach(() => {
  actionMock.mockReset();
  redirectMock.mockClear();
});

describe("resetPasswordAction", () => {
  it("restablecimiento correcto redirige a /login?passwordReset=1 (sin cookie que fijar)", async () => {
    actionMock.mockResolvedValue(null);

    await expect(
      resetPasswordAction({ email: "marta@ejemplo.com", code: "123456", newPassword: "nuevaPass123" }),
    ).rejects.toThrow("NEXT_REDIRECT:/login?passwordReset=1");
  });

  it("código inválido/caducado devuelve el código, sin redirigir", async () => {
    actionMock.mockRejectedValue(new ConvexError({ code: "RESET_CODE_INVALID", message: "..." }));

    const result = await resetPasswordAction({ email: "marta@ejemplo.com", code: "123456", newPassword: "nuevaPass123" });

    expect(result).toEqual({ error: "RESET_CODE_INVALID" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("contraseña demasiado corta devuelve el código correspondiente", async () => {
    actionMock.mockRejectedValue(new ConvexError({ code: "PASSWORD_TOO_SHORT", message: "..." }));

    const result = await resetPasswordAction({ email: "marta@ejemplo.com", code: "123456", newPassword: "corta" });

    expect(result).toEqual({ error: "PASSWORD_TOO_SHORT" });
  });

  it("PASSWORD_RESET_NOT_CONFIGURED devuelve el código correspondiente", async () => {
    actionMock.mockRejectedValue(new ConvexError({ code: "PASSWORD_RESET_NOT_CONFIGURED", message: "..." }));

    const result = await resetPasswordAction({ email: "marta@ejemplo.com", code: "123456", newPassword: "nuevaPass123" });

    expect(result).toEqual({ error: "PASSWORD_RESET_NOT_CONFIGURED" });
  });

  it("error no reconocido no filtra el mensaje interno, devuelve UNKNOWN", async () => {
    actionMock.mockRejectedValue(new Error("detalle interno sensible"));

    const result = await resetPasswordAction({ email: "marta@ejemplo.com", code: "123456", newPassword: "nuevaPass123" });

    expect(result).toEqual({ error: "UNKNOWN" });
  });
});
