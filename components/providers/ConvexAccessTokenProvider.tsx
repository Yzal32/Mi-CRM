"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const ENDPOINT = "/api/auth/convex-token";
// Refresca 5 min antes de la caducidad real (20 min de TTL en el servidor,
// ver convex/model/sessions.ts) — margen para que la llamada en vuelo nunca
// choque justo con el instante en que Convex empieza a rechazar el token.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 30 * 1000;
// Mismo formato que TOKEN_PATTERN en convex/model/sessions.ts (hex-64, 32
// bytes) — duplicado aquí a propósito en vez de importado: ese módulo es
// server-only (bcryptjs, código de la API interna de Convex) y no debe
// entrar en el bundle de cliente.
const ACCESS_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
// Cota defensiva, no el TTL real (20 min, ver ACCESS_TOKEN_TTL_MS en el
// servidor): solo descarta valores absurdos (NaN/Infinity, un contrato roto,
// relojes claramente desincronizados), nunca debería rechazar un token
// legítimo.
const MAX_REASONABLE_REMAINING_MS = 24 * 60 * 60 * 1000;

export type AccessTokenContextValue = { token: string | undefined; refresh: () => Promise<void> };

// Exportado (no solo el hook) porque ConvexAuthErrorBoundary.tsx es un
// componente de clase — necesita el objeto Context en sí para
// `static contextType`, no puede usar `useContext`.
export const ConvexAccessTokenContext = createContext<AccessTokenContextValue | null>(null);

type SuccessBody = { token: string; expiresAt: number; serverNow: number };
const KNOWN_ERROR_CODES = ["NO_SESSION", "SESSION_INVALID", "PASSWORD_CHANGE_REQUIRED", "FORBIDDEN", "UNKNOWN"] as const;
type ErrorBody = { error: (typeof KNOWN_ERROR_CODES)[number] };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// Ronda 7 de auditoría (hallazgo mayor): response.json() ya no lanza sin
// capturar (ronda 6), pero un 200 con forma incorrecta ({}? campos del tipo
// equivocado?) pasaba el `as SuccessBody` sin ninguna comprobación real —
// remainingMs salía NaN, se instalaba un token inválido y scheduleAt(NaN)
// programaba un timer inmediato (Math.max(NaN, 0) también es NaN, y
// setTimeout trata un delay no numérico como 0), entrando en un bucle de
// peticiones. Valida el contrato entero antes de tocar ningún estado.
function parseSuccessBody(body: unknown): SuccessBody | null {
  if (typeof body !== "object" || body === null) return null;
  const { token, expiresAt, serverNow } = body as Record<string, unknown>;
  if (typeof token !== "string" || !ACCESS_TOKEN_PATTERN.test(token)) return null;
  if (!isFiniteNumber(expiresAt) || !isFiniteNumber(serverNow)) return null;
  const remainingMs = expiresAt - serverNow;
  if (remainingMs <= 0 || remainingMs > MAX_REASONABLE_REMAINING_MS) return null;
  return { token, expiresAt, serverNow };
}

// Ronda 8 de auditoría (hallazgo mayor, mismo patrón que parseSuccessBody):
// un 401/403 con un cuerpo sintácticamente válido pero con forma incorrecta
// (`null`, `{}`, `{ error: 123 }`...) superaba el try/catch de
// response.json() (no lanza: `null` es JSON válido) y el `as ErrorBody`
// dejaba pasar cualquier cosa — leer `.error` sobre `null` lanza un
// TypeError que escapaba del IIFE igual que el bug de response.json() sin
// capturar (ronda 6), dejando la recuperación de sesión rota para siempre.
function parseErrorBody(body: unknown): ErrorBody | null {
  if (typeof body !== "object" || body === null) return null;
  const { error } = body as Record<string, unknown>;
  if (typeof error !== "string") return null;
  if (!(KNOWN_ERROR_CODES as readonly string[]).includes(error)) return null;
  return { error: error as ErrorBody["error"] };
}

/**
 * Emite y renueva el accessToken de corta duración (PRO-59) que las 13
 * funciones públicas de negocio exigen — nunca lo lee de una cookie: viaja
 * solo en la respuesta del fetch y vive en memoria (este estado de React),
 * jamás en `document.cookie`/localStorage.
 *
 * Nunca toca la cookie httpOnly de sesión (`session_token`): no podría —
 * este componente es "use client", y esa cookie es server-only (ver
 * lib/auth/session.ts). Borrarla es responsabilidad exclusiva del Route
 * Handler (app/api/auth/convex-token/route.ts), que ya lo hace en su
 * respuesta ante SESSION_INVALID.
 */
export function ConvexAccessTokenProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | undefined>(undefined);

  // Instante LOCAL (Date.now()) al que este token deja de considerarse
  // vigente — derivado de `serverNow` (mismo reloj de Convex que calculó
  // `expiresAt`, ver route.ts), nunca comparado directamente contra el
  // epoch de Convex: con el reloj del dispositivo desajustado, comparar en
  // crudo podría refrescar sin parar (reloj adelantado) o seguir usando un
  // token que Convex ya considera vencido (reloj atrasado).
  const localExpiresAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Rompe el ciclo refresh <-> scheduleAt (uno programa al otro) sin meter
  // ninguno de los dos en el array de dependencias del otro.
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleAt = useCallback(
    (delayMs: number) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        void refreshRef.current();
      }, Math.max(delayMs, 0));
    },
    [clearTimer],
  );

  const refresh = useCallback(async (): Promise<void> => {
    // Single-flight: una petición ya en vuelo se reutiliza en vez de
    // disparar una segunda concurrente (p. ej. el timer programado y un
    // foco de ventana coincidiendo).
    if (inFlightRef.current) return inFlightRef.current;

    const controller = new AbortController();
    abortRef.current = controller;

    const run = (async () => {
      let response: Response;
      try {
        response = await fetch(ENDPOINT, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          // Desmontado mientras la petición estaba en vuelo: no queda
          // ningún estado que actualizar ni reintento que programar.
          return;
        }
        // Red caída u otro fallo de transporte — mismo tratamiento que un
        // 5xx: reintento más tarde, sin tocar un token todavía vigente.
        scheduleAt(RETRY_DELAY_MS);
        return;
      }

      if (response.status === 200 || response.status === 401 || response.status === 403) {
        // response.json() puede rechazar (cuerpo vacío/no-JSON, lectura
        // cortada a medias) igual que el propio fetch — sin este try/catch,
        // el rechazo escapaba del IIFE, `refresh()` se propagaba rechazada, y
        // como los llamadores hacen `void refreshRef.current()` (sin
        // `.catch`), terminaba en una promesa rechazada sin manejar y, si
        // ocurría en el fetch inicial, el token se quedaba en `undefined`
        // para siempre porque nunca se programaba un reintento.
        let body: SuccessBody | ErrorBody;
        try {
          body = await response.json();
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          scheduleAt(RETRY_DELAY_MS);
          return;
        }

        if (response.status === 200) {
          const successBody = parseSuccessBody(body);
          if (!successBody) {
            // Contrato inválido (200 con forma incorrecta): mismo
            // tratamiento que un fallo de transporte, nunca un temporizador
            // inmediato — ver parseSuccessBody.
            scheduleAt(RETRY_DELAY_MS);
            return;
          }
          const remainingMs = successBody.expiresAt - successBody.serverNow;
          localExpiresAtRef.current = Date.now() + remainingMs;
          setToken(successBody.token);
          scheduleAt(remainingMs - REFRESH_MARGIN_MS);
          return;
        }

        const errorBody = parseErrorBody(body);
        if (!errorBody) {
          // Contrato inválido (401/403 con forma incorrecta, p. ej. `null`
          // o `{}`): mismo tratamiento que un fallo de transporte, nunca un
          // TypeError al leer `.error` de algo que no es el objeto esperado
          // — ver parseErrorBody.
          scheduleAt(RETRY_DELAY_MS);
          return;
        }
        if (errorBody.error === "NO_SESSION" || errorBody.error === "SESSION_INVALID") {
          // Terminal: sin reintento. La cookie ya la ha borrado el propio
          // Route Handler si el motivo fue SESSION_INVALID (ver arriba) —
          // este provider nunca la toca.
          clearTimer();
          localExpiresAtRef.current = null;
          setToken(undefined);
          // Navegación dura deliberada (no useRouter/redirect): limpia
          // también cualquier estado de cliente en memoria de golpe, sin
          // depender de que cada componente reaccione a un token undefined.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa intencional, ver comentario de arriba
          window.location.assign("/login");
          return;
        }
        if (errorBody.error === "PASSWORD_CHANGE_REQUIRED") {
          // Terminal, pero distinto del caso anterior: la sesión sigue
          // siendo válida (por eso NO se toca la cookie de sesión larga),
          // solo hace falta completar el cambio de contraseña.
          clearTimer();
          localExpiresAtRef.current = null;
          setToken(undefined);
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa intencional, mismo criterio que el caso SESSION_INVALID de arriba
          window.location.assign("/cambiar-contrasena");
          return;
        }
        // FORBIDDEN / UNKNOWN: cae al reintento de abajo (la forma inesperada
        // del DTO ya se descartó arriba, en el `if (!errorBody)`).
      }

      // 5xx / cualquier otro caso inesperado: reintento más tarde, sin tocar
      // un token todavía vigente en estado.
      scheduleAt(RETRY_DELAY_MS);
    })();

    inFlightRef.current = run;
    try {
      await run;
    } finally {
      // Guard de identidad: si esta `run` ya no es la que ocupa
      // inFlightRef.current (ver el reset síncrono en el cleanup del efecto
      // de montaje, más abajo), no la toca — evita que una `run` abortada y
      // resuelta tarde borre por error el seguimiento de un intento más
      // nuevo que ya esté en vuelo.
      if (inFlightRef.current === run) {
        inFlightRef.current = null;
      }
    }
  }, [clearTimer, scheduleAt]);

  // Actualizar el ref en un efecto, no durante el render: `refresh` es
  // estable en la práctica (sus dependencias — clearTimer/scheduleAt — no
  // cambian), así que este efecto solo corre una vez, antes del efecto de
  // montaje de abajo (React ejecuta los efectos en el orden en que se
  // declaran dentro del mismo commit).
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    void refreshRef.current();

    function handleBecameVisible() {
      if (document.visibilityState !== "visible") return;
      const expiresAt = localExpiresAtRef.current;
      const isExpired = expiresAt === null || expiresAt <= Date.now();
      if (!isExpired) return;
      localExpiresAtRef.current = null;
      setToken(undefined);
      void refreshRef.current();
    }

    window.addEventListener("focus", handleBecameVisible);
    document.addEventListener("visibilitychange", handleBecameVisible);

    return () => {
      window.removeEventListener("focus", handleBecameVisible);
      document.removeEventListener("visibilitychange", handleBecameVisible);
      clearTimer();
      abortRef.current?.abort();
      // Ronda 6 de auditoría (hallazgo bloqueante): sin este reset síncrono,
      // un remount inmediato (React Strict Mode simula montar -> desmontar
      // -> volver a montar, sincrónicamente, dentro del mismo commit) veía
      // inFlightRef.current todavía apuntando a la petición recién abortada
      // — su propio `finally` no llega a limpiarlo hasta que el rechazo por
      // AbortError se propaga, ya como microtarea, después de que el segundo
      // montaje ya se ejecutó. El guard de single-flight de `refresh()`
      // reutilizaba entonces esa promesa abortada en vez de lanzar una
      // petición nueva, y como esa promesa se resuelve sin token y sin
      // programar reintento, todas las queries se quedaban en "skip" para
      // siempre. Al resetear aquí, el segundo montaje ve inFlightRef.current
      // en null y arranca una petición nueva de verdad; el guard de
      // identidad `inFlightRef.current === run` en el finally de refresh()
      // evita que la petición abortada, al resolver más tarde, borre por
      // error el seguimiento de esa petición nueva.
      abortRef.current = null;
      inFlightRef.current = null;
    };
    // Solo al montar/desmontar: refresh/clearTimer se leen siempre vía ref
    // (refreshRef), nunca capturados por este efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ConvexAccessTokenContext.Provider value={{ token, refresh }}>{children}</ConvexAccessTokenContext.Provider>;
}

export function useConvexAccessToken(): string | undefined {
  const ctx = useContext(ConvexAccessTokenContext);
  if (!ctx) throw new Error("useConvexAccessToken debe usarse dentro de ConvexAccessTokenProvider");
  return ctx.token;
}

export function useConvexAccessTokenRefresh(): () => Promise<void> {
  const ctx = useContext(ConvexAccessTokenContext);
  if (!ctx) throw new Error("useConvexAccessTokenRefresh debe usarse dentro de ConvexAccessTokenProvider");
  return ctx.refresh;
}
