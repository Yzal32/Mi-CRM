// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HoyQuickActionsOverlay } from "./HoyQuickActionsOverlay";

const onClose = vi.fn();
const onSelectVenta = vi.fn();
const onSelectNota = vi.fn();

afterEach(() => {
  cleanup();
  onClose.mockReset();
  onSelectVenta.mockReset();
  onSelectNota.mockReset();
});

function renderMenu() {
  return render(<HoyQuickActionsOverlay onClose={onClose} onSelectVenta={onSelectVenta} onSelectNota={onSelectNota} />);
}

describe("HoyQuickActionsOverlay", () => {
  it("muestra las 3 opciones", () => {
    renderMenu();
    expect(screen.getByText("Nuevo cliente")).toBeTruthy();
    expect(screen.getByText("Registrar venta")).toBeTruthy();
    expect(screen.getByText("Anotar interacción")).toBeTruthy();
  });

  it('"Nuevo cliente" es un enlace real hacia /clientes/nuevo', () => {
    renderMenu();
    const link = screen.getByRole("link", { name: /Nuevo cliente/ });
    expect(link.getAttribute("href")).toBe("/clientes/nuevo");
  });

  it('pulsar "Nuevo cliente" también cierra el menú (no debe quedar isSheetOpen colgado)', () => {
    renderMenu();
    fireEvent.click(screen.getByRole("link", { name: /Nuevo cliente/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pulsar "Registrar venta" llama a onSelectVenta', () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /Registrar venta/ }));
    expect(onSelectVenta).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('pulsar "Anotar interacción" llama a onSelectNota', () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /Anotar interacción/ }));
    expect(onSelectNota).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("el botón X del overlay llama a onClose", () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
