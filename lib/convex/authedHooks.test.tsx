// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import type { FunctionReference } from "convex/server";
import { ConvexAccessTokenContext } from "@/components/providers/ConvexAccessTokenProvider";
import { useAuthedMutation, useAuthedQuery } from "./authedHooks";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: (...args: unknown[]) => useMutationMock(...args),
}));

// Referencias opacas: authedHooks nunca inspecciona su forma, solo las
// reenvía tal cual a useQuery/useMutation (mockeados arriba).
const QUERY_REF = {} as FunctionReference<"query">;
const MUTATION_REF = {} as FunctionReference<"mutation">;

function makeWrapper(token: string | undefined) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ConvexAccessTokenContext.Provider value={{ token, refresh: vi.fn() }}>{children}</ConvexAccessTokenContext.Provider>;
  };
}

afterEach(() => {
  cleanup();
});

describe("useAuthedQuery", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it("con token presente, useQuery subyacente recibe los args con el token incluido", () => {
    useQueryMock.mockReturnValue("resultado");
    const { result } = renderHook(() => useAuthedQuery(QUERY_REF, { clientId: "c1" }), { wrapper: makeWrapper("tok1") });

    expect(useQueryMock).toHaveBeenCalledWith(QUERY_REF, { clientId: "c1", token: "tok1" });
    expect(result.current).toBe("resultado");
  });

  it("sin token disponible, useQuery subyacente siempre recibe skip", () => {
    renderHook(() => useAuthedQuery(QUERY_REF, { clientId: "c1" }), { wrapper: makeWrapper(undefined) });

    expect(useQueryMock).toHaveBeenCalledWith(QUERY_REF, "skip");
  });

  it('token presente + argumentos "skip" explícitos del consumidor -> useQuery subyacente recibe exactamente "skip"', () => {
    renderHook(() => useAuthedQuery(QUERY_REF, "skip"), { wrapper: makeWrapper("tok1") });

    // Nunca se intenta construir { ...("skip"), token }: el "skip" explícito
    // del consumidor tiene prioridad sobre la disponibilidad del token.
    expect(useQueryMock).toHaveBeenCalledWith(QUERY_REF, "skip");
  });

  it("un intento del consumidor de colar su propio token en los args no gana frente al del hook", () => {
    renderHook(() => useAuthedQuery(QUERY_REF, { clientId: "c1", token: "intentando-colarse" }), {
      wrapper: makeWrapper("tok-real"),
    });

    expect(useQueryMock).toHaveBeenCalledWith(QUERY_REF, { clientId: "c1", token: "tok-real" });
  });
});

describe("useAuthedMutation", () => {
  const mutateMock = vi.fn();

  beforeEach(() => {
    mutateMock.mockReset();
    useMutationMock.mockReturnValue(mutateMock);
  });

  it("sin token disponible, rechaza sin invocar la mutation real", async () => {
    const { result } = renderHook(() => useAuthedMutation(MUTATION_REF), { wrapper: makeWrapper(undefined) });

    await expect(result.current({ clientId: "c1" })).rejects.toThrow();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("con token, invoca la mutation real exactamente una vez con el token incluido, y devuelve su resultado", async () => {
    mutateMock.mockResolvedValue("ok");
    const { result } = renderHook(() => useAuthedMutation(MUTATION_REF), { wrapper: makeWrapper("tok1") });

    const value = await result.current({ clientId: "c1" });

    expect(value).toBe("ok");
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith({ clientId: "c1", token: "tok1" });
  });

  it("el token cambia entre renders -> la siguiente llamada usa el nuevo, no uno capturado antes", async () => {
    mutateMock.mockResolvedValue("ok");
    const tokenBox = { current: "tok1" };
    function DynamicWrapper({ children }: { children: ReactNode }) {
      return (
        <ConvexAccessTokenContext.Provider value={{ token: tokenBox.current, refresh: vi.fn() }}>
          {children}
        </ConvexAccessTokenContext.Provider>
      );
    }

    const { result, rerender } = renderHook(() => useAuthedMutation(MUTATION_REF), { wrapper: DynamicWrapper });

    await result.current({ clientId: "c1" });
    expect(mutateMock).toHaveBeenLastCalledWith({ clientId: "c1", token: "tok1" });

    tokenBox.current = "tok2";
    rerender();

    await result.current({ clientId: "c1" });
    expect(mutateMock).toHaveBeenLastCalledWith({ clientId: "c1", token: "tok2" });
  });
});
