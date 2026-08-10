// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HoyScreen } from "./HoyScreen";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), back: vi.fn() }),
}));

const useQueryMock = vi.fn();
vi.mock("@/lib/convex/authedHooks", () => ({
  useAuthedQuery: (...args: unknown[]) => useQueryMock(...args),
}));

afterEach(() => {
  cleanup();
  replaceMock.mockClear();
});

// El resto del comportamiento de HoyScreen (listado, búsqueda, estados
// vacíos) ya está cubierto por lib/hoy/deriveHoyViewState.test.ts y
// similares — estos tests solo cubren el toast de confirmación (PRO-57).
describe("HoyScreen — toast de confirmación de cambio de contraseña (PRO-57)", () => {
  it("sin showPasswordChangedToast no muestra el toast ni limpia la URL", () => {
    useQueryMock.mockReturnValue(undefined);
    render(<HoyScreen />);

    expect(screen.queryByText("Contraseña actualizada.")).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("con showPasswordChangedToast muestra el toast y limpia el query param una sola vez", () => {
    useQueryMock.mockReturnValue(undefined);
    render(<HoyScreen showPasswordChangedToast />);

    expect(screen.getByText("Contraseña actualizada.")).toBeTruthy();
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/", { scroll: false });
  });
});
