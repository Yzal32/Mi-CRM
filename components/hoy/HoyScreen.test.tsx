// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { api } from "@/convex/_generated/api";
import { HoyScreen } from "./HoyScreen";

// api.x.y (anyApi) genera un objeto NUEVO en cada acceso — no sirve como
// clave de Map por identidad. getFunctionName(ref) da un string estable
// independientemente de cuántas veces se acceda a la misma ruta, así que
// se usa como clave real (mismo patrón que FichaClienteScreen.test.tsx).
const queryResults = new Map<string, unknown>();
const mutationMock = vi.fn();
const replaceMock = vi.fn();
const pushMock = vi.fn();

const useQueryMock = vi.fn((ref: unknown, args: unknown) => {
  if (args === "skip") return undefined;
  return queryResults.get(getFunctionName(ref as never));
});

vi.mock("@/lib/convex/authedHooks", () => ({
  useAuthedQuery: (...callArgs: [unknown, unknown]) => useQueryMock(...callArgs),
  useAuthedMutation: () => mutationMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock, back: vi.fn() }),
}));

function setQuery(ref: unknown, value: unknown) {
  queryResults.set(getFunctionName(ref as never), value);
}

afterEach(() => {
  cleanup();
  queryResults.clear();
  useQueryMock.mockClear();
  mutationMock.mockReset();
  replaceMock.mockClear();
  pushMock.mockClear();
});

// El resto del comportamiento de HoyScreen (listado, búsqueda, estados
// vacíos) ya está cubierto por lib/hoy/deriveHoyViewState.test.ts y
// similares — estos tests solo cubren el toast de confirmación (PRO-57) y
// los accesos rápidos nuevos (PRO-60).
describe("HoyScreen — toast de confirmación de cambio de contraseña (PRO-57)", () => {
  it("sin showPasswordChangedToast no muestra el toast ni limpia la URL", () => {
    render(<HoyScreen />);

    expect(screen.queryByText("Contraseña actualizada.")).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("con showPasswordChangedToast muestra el toast y limpia el query param una sola vez", () => {
    render(<HoyScreen showPasswordChangedToast />);

    expect(screen.getByText("Contraseña actualizada.")).toBeTruthy();
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/", { scroll: false });
  });
});

describe("HoyScreen — accesos rápidos (PRO-60)", () => {
  it('el botón "Registrar venta" de escritorio abre el selector de cliente', () => {
    render(<HoyScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Registrar venta/ }));
    expect(screen.getByRole("heading", { name: "Registrar venta" })).toBeTruthy();
  });

  it('el botón "Anotar interacción" de escritorio abre el selector de cliente', () => {
    render(<HoyScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Anotar interacción/ }));
    expect(screen.getByRole("heading", { name: "Anotar interacción" })).toBeTruthy();
  });

  it("elegir un cliente en el flujo de venta navega a /clientes/{id}/venta", () => {
    setQuery(api.clients.list, { items: [{ clientId: "c1", name: "Carlos Ruiz" }], truncated: false });
    render(<HoyScreen />);

    fireEvent.click(screen.getByRole("button", { name: /Registrar venta/ }));
    fireEvent.click(screen.getByRole("button", { name: /Carlos Ruiz/ }));

    expect(pushMock).toHaveBeenCalledWith("/clientes/c1/venta");
  });

  it("elegir un cliente en el flujo de nota muestra el formulario 'Añadir nota'", () => {
    setQuery(api.clients.list, { items: [{ clientId: "c1", name: "Carlos Ruiz" }], truncated: false });
    setQuery(api.notes.listByClient, { featured: null, items: [], truncated: false });
    render(<HoyScreen />);

    fireEvent.click(screen.getByRole("button", { name: /Anotar interacción/ }));
    fireEvent.click(screen.getByRole("button", { name: /Carlos Ruiz/ }));

    expect(screen.getByRole("heading", { name: "Añadir nota" })).toBeTruthy();
    expect(screen.getByLabelText(/^Nota/)).toBeTruthy();
  });
});
