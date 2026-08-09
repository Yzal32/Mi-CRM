"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/IconButton";

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * true si `el` es un control real, visible e interactivo. Función pura y
 * exportada aparte del trap para poder probarla de forma aislada: jsdom no
 * calcula layout real, así que `offsetParent` no es fiable en un test de
 * componente sin mockearlo (ver components/ui/isFocusable.test.ts).
 */
export function isFocusable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.matches(":disabled") || el.getAttribute("aria-disabled") === "true") return false;
  // closest(), no solo el propio elemento: cubre un control sin estos
  // atributos directamente pero envuelto en un contenedor que sí los tiene.
  if (el.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
  const computed = window.getComputedStyle(el);
  if (computed.visibility === "hidden" || computed.display === "none") return false;
  if (el.offsetParent === null) return false;
  return el.matches(FOCUSABLE_SELECTOR);
}

function focusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isFocusable);
}

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  // Cambia cuando el contenido "lógico" del overlay cambia (p. ej. el paso
  // de un formulario a su confirmación en AnadirNotaOverlay) — dispara un
  // nuevo enfoque del primer focusable, porque si el elemento enfocado se
  // desmonta el navegador mueve el foco a document.body, fuera del panel.
  contentKey?: string | number;
  // Respaldo si el disparador original ya no está en el DOM al cerrar
  // (p. ej. el botón "Marcar seguimiento" desaparece en cuanto se guarda
  // el primer seguimiento, sustituido por SeguimientoCard).
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function Overlay({ title, onClose, children, footer, contentKey, returnFocusRef }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const gestureOnBackdrop = useRef(false);

  // Fondo inerte + bloqueo de scroll + captura del disparador, una sola
  // vez por apertura. inert se aplica solo a #app-shell, nunca al propio
  // overlay (que se porta fuera de ese árbol) — si estuviera dentro,
  // heredaría inert y dejaría de ser interactivo.
  useEffect(() => {
    const appShell = document.getElementById("app-shell");
    appShell?.setAttribute("inert", "");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    openerRef.current = document.activeElement;

    return () => {
      appShell?.removeAttribute("inert");
      document.body.style.overflow = previousOverflow;
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      } else if (returnFocusRef?.current) {
        // Se lee returnFocusRef.current en el momento del cleanup a
        // propósito (no una copia capturada al montar): es justo el valor
        // que interesa en el instante de cerrar, no el que hubiera al abrir.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        returnFocusRef.current.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar/desmontar
  }, []);

  // Foco inicial al abrir y cada vez que cambia contentKey: prioriza el
  // primer focusable dentro del CONTENIDO (children), no la cabecera/pie
  // fijos — mejor UX (p. ej. va directo al campo del formulario, no al
  // botón "Cerrar"), y si el contenido no tiene ningún focusable (como el
  // paso de confirmación de AnadirNotaOverlay, solo un párrafo), cae al
  // panel completo en vez de perder el foco.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const [firstInBody] = bodyRef.current ? focusableElements(bodyRef.current) : [];
    const [firstInPanel] = focusableElements(panel);
    (firstInBody ?? firstInPanel ?? panel).focus();
  }, [contentKey]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = focusableElements(panel);
    if (focusables.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // El gesto completo (pointerdown Y pointerup) debe empezar y terminar en
  // el backdrop — comparar solo el target del click no basta: un arrastre
  // iniciado dentro del panel puede despachar un click cuyo target
  // aparente sea igualmente el backdrop.
  function handleBackdropPointerDown(event: PointerEvent<HTMLDivElement>) {
    gestureOnBackdrop.current = event.target === event.currentTarget;
  }
  function handleBackdropPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) gestureOnBackdrop.current = false;
  }
  function handleBackdropPointerCancel() {
    gestureOnBackdrop.current = false;
  }
  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (gestureOnBackdrop.current && event.target === event.currentTarget) onClose();
    gestureOnBackdrop.current = false;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 lg:items-center"
      onPointerDown={handleBackdropPointerDown}
      onPointerUp={handleBackdropPointerUp}
      onPointerCancel={handleBackdropPointerCancel}
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="flex max-h-[90vh] w-full flex-col gap-4 overflow-y-auto rounded-t-xl bg-surface p-5 shadow-lg outline-none lg:max-w-[420px] lg:rounded-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-screen-title m-0 text-text">
            {title}
          </h2>
          <IconButton icon="x" label="Cerrar" variant="secondary" onClick={onClose} />
        </div>
        <div ref={bodyRef} className="contents">
          {children}
        </div>
        {footer && <div className="flex justify-end gap-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
