// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ConvexAccessTokenProvider, useConvexAccessToken } from "./ConvexAccessTokenProvider";

function Consumer() {
  const token = useConvexAccessToken();
  return <div data-testid="token">{token ?? "sin-token"}</div>;
}

// ReturnType<typeof vi.fn> (sin parametrizar) resuelve a un tipo unión no
// invocable — se parametriza explícitamente con la firma real para que
// `tsc` (npm run build) lo acepte como función llamable.
let assignMock: ReturnType<typeof vi.fn<(url: string) => void>>;
let fetchMock: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

function jsonResponse(status: number, body: unknown) {
  return { status, json: async () => body };
}

// Ronda 7 de auditoría: el provider ahora valida que `token` tenga formato
// hex-64 (igual que TOKEN_PATTERN en convex/model/sessions.ts) antes de
// instalarlo — un token de prueba corto en texto plano ya no basta, lo rechazaría.
const TOKEN_DEFECTO = "0".repeat(64);
const TOKEN_T1 = "1".repeat(64);
const TOKEN_T2 = "2".repeat(64);

// TTL realista (20 min) por defecto: con un remainingMs corto, el timer de
// refresco programado (remainingMs - margen de 5min) daría un delay
// negativo -> se dispara de inmediato (0ms) y encadena otra llamada a
// fetch dentro del mismo `flush()`, que ningún test espera explícitamente.
const DEFAULT_TTL_MS = 20 * 60 * 1000;

function defaultSuccessBody(token = TOKEN_DEFECTO) {
  const now = Date.now();
  return jsonResponse(200, { token, expiresAt: now + DEFAULT_TTL_MS, serverNow: now });
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  assignMock = vi.fn();
  // window.location.assign no se puede espiar directamente en jsdom (la
  // propiedad no es configurable) — se sustituye el objeto location entero.
  Object.defineProperty(window, "location", {
    value: { ...window.location, assign: assignMock },
    writable: true,
    configurable: true,
  });
  fetchMock = vi.fn();
  // Red de seguridad: cualquier llamada de fetch no cubierta explícitamente
  // por un mockResolvedValueOnce/mockRejectedValueOnce de un test concreto
  // (p. ej. un refresco en cascada disparado por el propio timer) recibe
  // una respuesta 200 realista en vez de `undefined`, que rompería el
  // provider con un TypeError no relacionado con lo que el test comprueba.
  fetchMock.mockResolvedValue(defaultSuccessBody());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ConvexAccessTokenProvider — respuesta 200", () => {
  it("guarda el token y lo expone a los consumidores", async () => {
    fetchMock.mockResolvedValueOnce(defaultSuccessBody(TOKEN_T1));
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(screen.getByTestId("token").textContent).toBe(TOKEN_T1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/convex-token",
      expect.objectContaining({ method: "POST", credentials: "same-origin", cache: "no-store" }),
    );
  });
});

describe("ConvexAccessTokenProvider — estados terminales", () => {
  it("401 SESSION_INVALID limpia el token y navega a /login, sin tocar la cookie", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "SESSION_INVALID" }));
    expect(document.cookie).toBe("");

    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(assignMock).toHaveBeenCalledWith("/login");
    expect(screen.getByTestId("token").textContent).toBe("sin-token");
    // El provider nunca toca document.cookie — el borrado real de la
    // cookie httpOnly ya lo hizo el propio Route Handler en su respuesta.
    expect(document.cookie).toBe("");
  });

  it("401 NO_SESSION navega a /login igual que SESSION_INVALID", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "NO_SESSION" }));
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(assignMock).toHaveBeenCalledWith("/login");
  });

  it("403 PASSWORD_CHANGE_REQUIRED limpia el token y navega a /cambiar-contrasena", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { error: "PASSWORD_CHANGE_REQUIRED" }));
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(assignMock).toHaveBeenCalledWith("/cambiar-contrasena");
    expect(assignMock).not.toHaveBeenCalledWith("/login");
    expect(screen.getByTestId("token").textContent).toBe("sin-token");
  });
});

describe("ConvexAccessTokenProvider — fallo de red / 5xx", () => {
  it("un fallo de red reintenta a los 30s, sin navegar", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(assignMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(defaultSuccessBody(TOKEN_T1));
    await flush(30_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("token").textContent).toBe(TOKEN_T1);
  });

  it("un 5xx en el refresco en segundo plano reintenta a los 30s, sin tocar el token ya vigente", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { token: TOKEN_T1, expiresAt: 20 * 60 * 1000 + 1000, serverNow: 1000 }));
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();
    expect(screen.getByTestId("token").textContent).toBe(TOKEN_T1);

    // El refresco programado (ttl - margen de 5min = 15min) responde 500.
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "UNKNOWN" }));
    await flush(15 * 60 * 1000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("token").textContent).toBe(TOKEN_T1); // no se ha limpiado
    expect(assignMock).not.toHaveBeenCalled();
  });
});

describe("ConvexAccessTokenProvider — corrección de reloj (ronda 4)", () => {
  it("programa el refresco según serverNow, no según el reloj local desajustado", async () => {
    // Reloj local muy adelantado respecto al del servidor: si se comparara
    // expiresAt directamente contra Date.now() local (el bug de antes), el
    // margen calculado sería incorrecto. Usando serverNow, el TTL real
    // (20 min) se preserva sea cual sea el desajuste.
    vi.setSystemTime(2_000_000);
    const serverNow = 1_000_000;
    const ttlMs = 20 * 60 * 1000;
    const expiresAt = serverNow + ttlMs;
    const refreshMarginMs = 5 * 60 * 1000;

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { token: TOKEN_T1, expiresAt, serverNow }));
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();
    expect(screen.getByTestId("token").textContent).toBe(TOKEN_T1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Calculado desde Date.now() LOCAL (2_000_000) + (expiresAt - serverNow), no desde el epoch de Convex en crudo.
    const expectedDelayMs = ttlMs - refreshMarginMs; // 15 min

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { token: TOKEN_T2, expiresAt: expiresAt + ttlMs, serverNow: serverNow + ttlMs }),
    );

    await flush(expectedDelayMs - 1000);
    expect(fetchMock).toHaveBeenCalledTimes(1); // todavía no toca refrescar

    await flush(2000);
    expect(fetchMock).toHaveBeenCalledTimes(2); // ahora sí
  });
});

describe("ConvexAccessTokenProvider — cancelación al desmontar (ronda 5)", () => {
  it("aborta el fetch en vuelo al desmontar, sin que el resultado tardío toque el estado", async () => {
    let capturedSignal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((...args: unknown[]) => {
      const options = args[1] as { signal: AbortSignal };
      return new Promise((_resolve, reject) => {
        capturedSignal = options.signal;
        options.signal.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });

    const { unmount } = render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );

    expect(capturedSignal?.aborted).toBe(false);
    unmount();
    expect(capturedSignal?.aborted).toBe(true);

    // Dejar correr los microtasks pendientes no debe lanzar ni disparar
    // ninguna navegación — el AbortError se traga silenciosamente.
    await flush();
    expect(assignMock).not.toHaveBeenCalled();
  });
});

describe("ConvexAccessTokenProvider — remount inmediato bajo StrictMode (ronda 6, hallazgo bloqueante)", () => {
  it("montar->desmontar->montar de forma síncrona no deja el token atascado sin valor para siempre", async () => {
    // La primera petición se queda colgada hasta que su signal se aborte
    // (igual que un fetch real interrumpido a media petición) — así se
    // reproduce el reset síncrono setup->cleanup->setup que hace StrictMode,
    // en vez de dejar que la mock se resuelva antes de que el remount ocurra.
    let firstSignal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((...args: unknown[]) => {
      const options = args[1] as { signal: AbortSignal };
      firstSignal = options.signal;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });
    fetchMock.mockResolvedValueOnce(defaultSuccessBody(TOKEN_T1));

    render(
      <StrictMode>
        <ConvexAccessTokenProvider>
          <Consumer />
        </ConvexAccessTokenProvider>
      </StrictMode>,
    );

    // El ciclo setup->cleanup->setup de StrictMode ya debe haber ocurrido de
    // forma síncrona dentro de este `render`: la primera petición, abortada;
    // la segunda (la del remount "real"), ya en vuelo.
    expect(firstSignal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await flush();

    // Antes de la corrección, el guard de single-flight reutilizaba la
    // promesa ya abortada del primer montaje y el segundo montaje nunca
    // llegaba a lanzar esta segunda petición — el token se quedaba en
    // "sin-token" para siempre.
    expect(screen.getByTestId("token").textContent).toBe(TOKEN_T1);
    expect(assignMock).not.toHaveBeenCalled();
  });
});

describe("ConvexAccessTokenProvider — cuerpo de respuesta no decodificable (ronda 6, hallazgo mayor)", () => {
  it("JSON inválido en una respuesta 200 reintenta a los 30s en vez de dejar una promesa rechazada sin manejar", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(screen.getByTestId("token").textContent).toBe("sin-token");
    expect(assignMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(defaultSuccessBody(TOKEN_T1));
    await flush(30_000);

    expect(screen.getByTestId("token").textContent).toBe(TOKEN_T1);
  });

  it("JSON inválido en una respuesta 401 también reintenta, sin navegar ni dejar una promesa sin manejar", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 401,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(assignMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("token").textContent).toBe("sin-token");

    fetchMock.mockResolvedValueOnce(defaultSuccessBody(TOKEN_T1));
    await flush(30_000);

    expect(screen.getByTestId("token").textContent).toBe(TOKEN_T1);
  });
});

describe("ConvexAccessTokenProvider — DTO 200 con forma incorrecta (ronda 7, hallazgo mayor)", () => {
  it("un cuerpo 200 vacío no instala ningún token ni programa un temporizador inmediato — reintenta a los 30s", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(screen.getByTestId("token").textContent).toBe("sin-token");
    // Antes de la corrección, remainingMs salía NaN y scheduleAt(NaN) programaba
    // un timer inmediato (setTimeout trata un delay no numérico como 0) — sin
    // avanzar el reloj todavía no debería haber un segundo intento.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(defaultSuccessBody(TOKEN_T1));
    await flush(30_000);

    expect(screen.getByTestId("token").textContent).toBe(TOKEN_T1);
  });

  it("expiresAt/serverNow no numéricos se rechazan, sin dejar NaN en el estado", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { token: TOKEN_T1, expiresAt: "no-es-un-numero", serverNow: Date.now() }),
    );
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(screen.getByTestId("token").textContent).toBe("sin-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(defaultSuccessBody(TOKEN_T1));
    await flush(30_000);

    expect(screen.getByTestId("token").textContent).toBe(TOKEN_T1);
  });

  it("un remainingMs no positivo (expiresAt <= serverNow) se rechaza, sin bucle de peticiones inmediatas", async () => {
    const now = Date.now();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { token: TOKEN_T1, expiresAt: now, serverNow: now + 1000 }));
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(screen.getByTestId("token").textContent).toBe("sin-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(defaultSuccessBody(TOKEN_T1));
    await flush(30_000);

    expect(screen.getByTestId("token").textContent).toBe(TOKEN_T1);
  });

  it("un remainingMs desproporcionadamente grande (p. ej. Infinity) se rechaza", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { token: TOKEN_T1, expiresAt: Number.POSITIVE_INFINITY, serverNow: Date.now() }),
    );
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(screen.getByTestId("token").textContent).toBe("sin-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("un token con formato inesperado (no hex-64) se rechaza", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { token: "no-es-hex", expiresAt: Date.now() + 1000, serverNow: Date.now() }),
    );
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(screen.getByTestId("token").textContent).toBe("sin-token");
  });
});

describe("ConvexAccessTokenProvider — DTO de error con forma incorrecta (ronda 8, hallazgo mayor)", () => {
  it("401 con cuerpo `null` (JSON válido, no lanza en response.json()) reintenta a los 30s en vez de un TypeError sin manejar", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, null));
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(screen.getByTestId("token").textContent).toBe("sin-token");
    expect(assignMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(defaultSuccessBody(TOKEN_T1));
    await flush(30_000);

    expect(screen.getByTestId("token").textContent).toBe(TOKEN_T1);
  });

  it("403 con cuerpo `null` reintenta a los 30s, sin navegar", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, null));
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(assignMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(defaultSuccessBody(TOKEN_T1));
    await flush(30_000);

    expect(screen.getByTestId("token").textContent).toBe(TOKEN_T1);
  });

  it("401 con `error` de un código desconocido (o de tipo incorrecto) reintenta, sin navegar", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 123 }));
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(assignMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("401 con `{}` (sin campo `error`) reintenta, sin navegar", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));
    render(
      <ConvexAccessTokenProvider>
        <Consumer />
      </ConvexAccessTokenProvider>,
    );
    await flush();

    expect(assignMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
