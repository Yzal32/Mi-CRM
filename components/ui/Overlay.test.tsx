// @vitest-environment jsdom
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Overlay } from "./Overlay";

// jsdom no calcula layout real: sin esto, todo offsetParent es null y el
// trap de foco nunca se ejercitaría de verdad (todo caería en el panel de
// respaldo). Se captura y restaura el descriptor original para no
// contaminar otras suites que corran después.
let originalOffsetParentDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  originalOffsetParentDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      return document.body;
    },
  });

  const appShell = document.createElement("div");
  appShell.id = "app-shell";
  document.body.appendChild(appShell);
});

afterEach(() => {
  if (originalOffsetParentDescriptor) {
    Object.defineProperty(HTMLElement.prototype, "offsetParent", originalOffsetParentDescriptor);
  } else {
    delete (HTMLElement.prototype as unknown as { offsetParent?: unknown }).offsetParent;
  }
  document.getElementById("app-shell")?.remove();
  cleanup();
});

function TriggerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Abrir</button>
      {open && (
        <Overlay title="Título" onClose={() => setOpen(false)}>
          <button>Contenido</button>
        </Overlay>
      )}
    </div>
  );
}

function ToggleHarness() {
  const [open, setOpen] = useState(true);
  return open ? (
    <Overlay title="Título" onClose={() => setOpen(false)}>
      <button>Contenido</button>
    </Overlay>
  ) : null;
}

function TrapHarness({ onCloseSpy }: { onCloseSpy: () => void }) {
  return (
    <Overlay title="Título de prueba" onClose={onCloseSpy} footer={<button>Acción</button>}>
      <button>Primero</button>
      <button disabled>Deshabilitado</button>
      <button>Último</button>
    </Overlay>
  );
}

function DisconnectableTriggerHarness() {
  const [showTrigger, setShowTrigger] = useState(true);
  const [open, setOpen] = useState(false);
  const fallbackRef = useRef<HTMLHeadingElement>(null);
  return (
    <div>
      <h2 ref={fallbackRef} tabIndex={-1}>
        Encabezado de respaldo
      </h2>
      {showTrigger && <button onClick={() => setOpen(true)}>Abrir</button>}
      <button onClick={() => setShowTrigger(false)}>Quitar disparador</button>
      {open && (
        <Overlay title="Título" onClose={() => setOpen(false)} returnFocusRef={fallbackRef}>
          <button>Contenido</button>
        </Overlay>
      )}
    </div>
  );
}

function StepHarness() {
  const [step, setStep] = useState<"form" | "confirm">("form");
  return (
    <Overlay
      title="Título"
      onClose={() => {}}
      contentKey={step}
      footer={step === "confirm" ? <button>Confirmar</button> : undefined}
    >
      {step === "form" ? (
        <button onClick={() => setStep("confirm")}>Ir a confirmar</button>
      ) : (
        <p>Solo texto, sin controles interactivos.</p>
      )}
    </Overlay>
  );
}

describe("Overlay", () => {
  it("Escape cierra", () => {
    const onClose = vi.fn();
    render(<TrapHarness onCloseSpy={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restaura el foco al elemento que abrió el overlay tras cerrar", async () => {
    render(<TriggerHarness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("si el disparador original ya no está conectado al cerrar, el foco cae en returnFocusRef (p. ej. el botón 'Marcar seguimiento' que desaparece al guardar el primer seguimiento)", async () => {
    render(<DisconnectableTriggerHarness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog");

    // El disparador desaparece MIENTRAS el overlay sigue abierto — simula
    // la reactividad de Convex sustituyendo el EmptyState por la vista con
    // datos antes de que el usuario llegue a cerrar el overlay.
    fireEvent.click(screen.getByRole("button", { name: "Quitar disparador" }));
    expect(screen.queryByRole("button", { name: "Abrir" })).toBeNull();

    fireEvent.keyDown(dialog, { key: "Escape" });

    const fallback = screen.getByRole("heading", { name: "Encabezado de respaldo" });
    await waitFor(() => expect(document.activeElement).toBe(fallback));
  });

  it("bloquea el scroll del fondo mientras está abierto y lo restaura al cerrar", () => {
    const originalOverflow = document.body.style.overflow;
    const { unmount } = render(<ToggleHarness />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it("#app-shell queda inert mientras está abierto, y el propio overlay sigue focuseable", () => {
    const { unmount } = render(<ToggleHarness />);
    expect(document.getElementById("app-shell")?.hasAttribute("inert")).toBe(true);
    expect(screen.getByRole("dialog").hasAttribute("inert")).toBe(false);
    unmount();
    expect(document.getElementById("app-shell")?.hasAttribute("inert")).toBe(false);
  });

  it("el foco inicial va al primer focusable del CONTENIDO, no al botón Cerrar de la cabecera", async () => {
    render(<TrapHarness onCloseSpy={vi.fn()} />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Primero" })));
  });

  it("el trap de Tab cicla entre los focusables reales, saltándose el botón deshabilitado", () => {
    render(<TrapHarness onCloseSpy={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    const closeButton = screen.getByRole("button", { name: "Cerrar" });
    const action = screen.getByRole("button", { name: "Acción" });

    // Desde el primer focusable real del panel completo (Cerrar),
    // Shift+Tab envuelve al último (Acción, en el footer) — saltándose
    // "Deshabilitado" por el camino.
    closeButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(action);

    // Desde el último (Acción), Tab envuelve de vuelta al primero (Cerrar).
    action.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
  });

  it("cambiar contentKey mantiene el foco real dentro del panel, no en document.body (clic real, sin simular Tab)", async () => {
    render(<StepHarness />);
    const dialog = screen.getByRole("dialog");
    const goToConfirm = screen.getByRole("button", { name: "Ir a confirmar" });

    fireEvent.click(goToConfirm);

    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("backdrop: cierra si el gesto completo (pointerdown y pointerup) empieza y termina en el backdrop", () => {
    const onClose = vi.fn();
    render(<TrapHarness onCloseSpy={onClose} />);
    const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;

    // Despachados directamente sobre el backdrop: target === currentTarget.
    fireEvent.pointerDown(backdrop);
    fireEvent.pointerUp(backdrop);
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop: NO cierra si el gesto empezó dentro del panel aunque el click aparente terminar en el backdrop", () => {
    const onClose = vi.fn();
    render(<TrapHarness onCloseSpy={onClose} />);
    const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;
    const panel = screen.getByRole("dialog");

    // pointerdown originado DENTRO del panel (evento real que burbujea
    // hasta el handler del backdrop con target === panel !== backdrop).
    fireEvent.pointerDown(panel);
    // pointerup y click sí ocurren directamente en el backdrop.
    fireEvent.pointerUp(backdrop);
    fireEvent.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("backdrop: pointercancel limpia el estado del gesto, un click posterior no cierra por error", () => {
    const onClose = vi.fn();
    render(<TrapHarness onCloseSpy={onClose} />);
    const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;

    fireEvent.pointerDown(backdrop);
    fireEvent.pointerCancel(backdrop);
    fireEvent.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });
});
