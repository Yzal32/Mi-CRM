// @vitest-environment jsdom
import { useCallback, useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { ConvexAccessTokenContext, type AccessTokenContextValue } from "./ConvexAccessTokenProvider";
import { ConvexAuthErrorBoundary } from "./ConvexAuthErrorBoundary";

// ReturnType<typeof vi.fn> (sin parametrizar) resuelve a un tipo unión no
// invocable — se parametriza explícitamente con la firma real para que
// `tsc` (npm run build) lo acepte como función llamable.
let assignMock: ReturnType<typeof vi.fn<(url: string) => void>>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  assignMock = vi.fn();
  Object.defineProperty(window, "location", {
    value: { ...window.location, assign: assignMock },
    writable: true,
    configurable: true,
  });
  // React registra en consola los errores que un boundary captura, aunque
  // los capture correctamente — es ruido esperado en estos tests, no un
  // fallo real.
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
});

function ThrowingChild({ token, bad }: { token: string; bad: Set<string> }) {
  if (bad.has(token)) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "No se pudo verificar la sesión." });
  }
  return <div data-testid="content">OK con {token}</div>;
}

type Ctrl = { current: () => void };

/**
 * `refresh()` (lo que el boundary llama) y `controlRef.current()` (un
 * cambio de token DISPARADO POR EL TEST, no por el boundary) avanzan el
 * mismo índice de tokens pero representan dos orígenes distintos — igual
 * que en la app real, donde el token también puede cambiar por el propio
 * ciclo de refresco en segundo plano del provider, no solo porque el
 * boundary lo haya pedido tras un error.
 */
function Harness({
  tokens,
  bad,
  refreshMock,
  controlRef,
}: {
  tokens: string[];
  bad: Set<string>;
  refreshMock: ReturnType<typeof vi.fn<() => void>>;
  controlRef: Ctrl;
}) {
  const [index, setIndex] = useState(0);
  const advance = useCallback(() => setIndex((i) => Math.min(i + 1, tokens.length - 1)), [tokens.length]);
  useEffect(() => {
    controlRef.current = advance;
  }, [advance, controlRef]);
  const refresh = useCallback(async () => {
    refreshMock();
    advance();
  }, [advance, refreshMock]);
  const token = tokens[index];
  const value: AccessTokenContextValue = { token, refresh };
  return (
    <ConvexAccessTokenContext.Provider value={value}>
      <ConvexAuthErrorBoundary>
        <ThrowingChild token={token} bad={bad} />
      </ConvexAuthErrorBoundary>
    </ConvexAccessTokenContext.Provider>
  );
}

describe("ConvexAuthErrorBoundary — bucle real (el hallazgo bloqueante de la ronda 3)", () => {
  it("token A falla, el token B recuperado TAMBIÉN falla -> navega a /login sin pedir un tercer token", async () => {
    const refreshMock = vi.fn();
    const controlRef: Ctrl = { current: () => {} };

    render(<Harness tokens={["A", "B", "C"]} bad={new Set(["A", "B"])} refreshMock={refreshMock} controlRef={controlRef} />);

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("/login"));
    // Exactamente una llamada a refresh (la que pidió B) — nunca se llega a pedir C.
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});

describe("ConvexAuthErrorBoundary — recuperación certificada y reseteo entre incidentes", () => {
  it("A falla, B (refrescado) funciona -> se recupera sola; un incidente independiente posterior recibe su propio intento", async () => {
    const refreshMock = vi.fn();
    const controlRef: Ctrl = { current: () => {} };

    render(
      <Harness tokens={["A", "B", "C", "D"]} bad={new Set(["A", "C"])} refreshMock={refreshMock} controlRef={controlRef} />,
    );

    // Incidente 1: A falla, se recupera con B.
    await waitFor(() => expect(screen.getByTestId("content").textContent).toBe("OK con B"));
    expect(assignMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledTimes(1);

    // Un rato después, el token cambia de forma independiente al ciclo del
    // boundary (p. ej. el refresco en segundo plano del provider) y resulta
    // que el nuevo (C) también está mal. Como el incidente anterior ya se
    // había certificado como resuelto (recoveryAttempted se limpió), esto
    // debe tratarse como un fallo NUEVO, con su propio intento de
    // recuperación — no como una continuación del primero.
    await act(async () => controlRef.current());

    await waitFor(() => expect(screen.getByTestId("content").textContent).toBe("OK con D"));
    expect(assignMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledTimes(2);
  });
});

describe("ConvexAuthErrorBoundary — error genérico", () => {
  function GenericThrower(): never {
    throw new Error("boom");
  }

  it("muestra el EmptyState local, nunca llama a refresh ni navega", async () => {
    const refreshMock = vi.fn();
    render(
      <ConvexAccessTokenContext.Provider value={{ token: "A", refresh: refreshMock }}>
        <ConvexAuthErrorBoundary>
          <GenericThrower />
        </ConvexAuthErrorBoundary>
      </ConvexAccessTokenContext.Provider>,
    );

    expect(await screen.findByText("Algo ha fallado")).toBeTruthy();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    // GenericThrower vuelve a lanzar de inmediato (nada cambió) — el
    // fallback reaparece, pero solo porque el usuario lo pidió, no en bucle
    // automático.
    expect(await screen.findByText("Algo ha fallado")).toBeTruthy();
  });

  it("un cambio de token en segundo plano NO limpia un error genérico (solo 'auth' se recupera sola)", async () => {
    const refreshMock = vi.fn();
    function Wrapper({ token }: { token: string }) {
      return (
        <ConvexAccessTokenContext.Provider value={{ token, refresh: refreshMock }}>
          <ConvexAuthErrorBoundary>
            <GenericThrower />
          </ConvexAuthErrorBoundary>
        </ConvexAccessTokenContext.Provider>
      );
    }

    const { rerender } = render(<Wrapper token="A" />);
    expect(await screen.findByText("Algo ha fallado")).toBeTruthy();

    // El token cambia (p. ej. el provider lo refrescó por su cuenta, sin
    // relación con este error) — componentDidUpdate solo actúa sobre
    // errorKind === "auth", así que el fallback genérico debe seguir ahí.
    rerender(<Wrapper token="B" />);

    expect(screen.getByText("Algo ha fallado")).toBeTruthy();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
