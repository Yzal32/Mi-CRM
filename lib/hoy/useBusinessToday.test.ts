// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBusinessToday } from "./useBusinessToday";

describe("useBusinessToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve el día de negocio inicial en Europe/Madrid", () => {
    // 2026-01-01T23:30:00Z es 2026-01-02 en Madrid (invierno, UTC+1)
    vi.setSystemTime(new Date("2026-01-01T23:30:00Z"));
    const { result } = renderHook(() => useBusinessToday());
    expect(result.current).toBe("2026-01-02");
  });

  it("actualiza su valor tras cruzar la medianoche de Madrid (no solo la función pura)", () => {
    // 2026-01-01T22:30:00Z -> todavía 2026-01-01 en Madrid (23:30 local, invierno)
    vi.setSystemTime(new Date("2026-01-01T22:30:00Z"));
    const { result } = renderHook(() => useBusinessToday());
    expect(result.current).toBe("2026-01-01");

    // Avanza el reloj del sistema y los timers hasta pasar la medianoche
    // local de Madrid (00:00 del 2026-01-02, es decir 23:00 UTC) y más allá
    // del intervalo de recálculo de 60s del hook.
    act(() => {
      vi.setSystemTime(new Date("2026-01-01T23:30:00Z"));
      vi.advanceTimersByTime(65_000);
    });

    expect(result.current).toBe("2026-01-02");
  });

  it("no vuelve a re-renderizar si el día de negocio no cambió", () => {
    vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
    const { result } = renderHook(() => useBusinessToday());
    const first = result.current;

    act(() => {
      vi.advanceTimersByTime(65_000);
    });

    expect(result.current).toBe(first);
  });
});
