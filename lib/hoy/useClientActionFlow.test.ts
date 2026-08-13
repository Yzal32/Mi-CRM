// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useClientActionFlow } from "./useClientActionFlow";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const CLIENT = { clientId: "client1" as never, name: "Carlos Ruiz" };

afterEach(() => {
  pushMock.mockReset();
});

describe("useClientActionFlow", () => {
  it("empieza en idle", () => {
    const { result } = renderHook(() => useClientActionFlow());
    expect(result.current.state).toEqual({ step: "idle" });
  });

  it("start(intent) pasa a pickingClient con ese intent", () => {
    const { result } = renderHook(() => useClientActionFlow());
    act(() => result.current.start("nota"));
    expect(result.current.state).toEqual({ step: "pickingClient", intent: "nota" });
  });

  it("selectClient con intent venta navega a /clientes/{id}/venta y vuelve a idle", () => {
    const { result } = renderHook(() => useClientActionFlow());
    act(() => result.current.start("venta"));
    act(() => result.current.selectClient(CLIENT));

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/clientes/client1/venta");
    expect(result.current.state).toEqual({ step: "idle" });
  });

  it("selectClient con intent nota pasa a notaClient sin navegar", () => {
    const { result } = renderHook(() => useClientActionFlow());
    act(() => result.current.start("nota"));
    act(() => result.current.selectClient(CLIENT));

    expect(pushMock).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ step: "notaClient", client: CLIENT });
  });

  it("cancelPicking desde pickingClient vuelve a idle sin navegar", () => {
    const { result } = renderHook(() => useClientActionFlow());
    act(() => result.current.start("venta"));
    act(() => result.current.cancelPicking());

    expect(pushMock).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ step: "idle" });
  });

  it("closeNota desde notaClient vuelve a idle", () => {
    const { result } = renderHook(() => useClientActionFlow());
    act(() => result.current.start("nota"));
    act(() => result.current.selectClient(CLIENT));
    act(() => result.current.closeNota());

    expect(result.current.state).toEqual({ step: "idle" });
  });

  it("selectClient llamado en idle es un no-op defensivo (no navega, no cambia de estado)", () => {
    const { result } = renderHook(() => useClientActionFlow());
    act(() => result.current.selectClient(CLIENT));

    expect(pushMock).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ step: "idle" });
  });
});
