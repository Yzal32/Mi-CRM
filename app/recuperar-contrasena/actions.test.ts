import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { requestPasswordResetAction } from "./actions";

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

describe("requestPasswordResetAction", () => {
  it("Convex resuelve sin error -> redirige a /restablecer-contrasena con el email en la URL", async () => {
    actionMock.mockResolvedValue(null);

    await expect(requestPasswordResetAction({ email: "existe@ejemplo.com" })).rejects.toThrow(
      "NEXT_REDIRECT:/restablecer-contrasena?email=existe%40ejemplo.com",
    );
    expect(actionMock).toHaveBeenCalledWith(expect.anything(), { email: "existe@ejemplo.com" });
  });

  it("Convex lanza (email inexistente, pepper sin configurar, red caída, etc.) -> mismo redirect, nunca se filtra el motivo", async () => {
    actionMock.mockRejectedValue(new ConvexError({ code: "PASSWORD_RESET_NOT_CONFIGURED", message: "..." }));

    await expect(requestPasswordResetAction({ email: "no-existe@ejemplo.com" })).rejects.toThrow(
      "NEXT_REDIRECT:/restablecer-contrasena?email=no-existe%40ejemplo.com",
    );
  });
});
