// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast } from "./Toast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Toast", () => {
  it("muestra el mensaje", () => {
    render(<Toast message="Contraseña actualizada." onDismiss={vi.fn()} />);
    expect(screen.getByText("Contraseña actualizada.")).toBeTruthy();
  });

  it("llama a onDismiss una sola vez al pasar 2600ms", () => {
    const onDismiss = vi.fn();
    render(<Toast message="Contraseña actualizada." onDismiss={onDismiss} />);

    vi.advanceTimersByTime(2599);
    expect(onDismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("una nueva identidad de onDismiss a mitad del temporizador no lo reinicia ni duplica la llamada", () => {
    const onDismissA = vi.fn();
    const { rerender } = render(<Toast message="Contraseña actualizada." onDismiss={onDismissA} />);

    vi.advanceTimersByTime(1500);
    const onDismissB = vi.fn();
    rerender(<Toast message="Contraseña actualizada." onDismiss={onDismissB} />);

    // Si el efecto dependiera de onDismiss por identidad, este segundo avance
    // de 1500ms no llegaría a los 2600ms totales porque el timer se habría
    // reiniciado en el rerender.
    vi.advanceTimersByTime(1100);
    expect(onDismissA).not.toHaveBeenCalled();
    expect(onDismissB).toHaveBeenCalledTimes(1);
  });
});
