"use client";

import { Component, type ContextType, type ReactNode } from "react";
import { ConvexError } from "convex/values";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConvexAccessTokenContext } from "./ConvexAccessTokenProvider";

type ErrorKind = "auth" | "generic";

type State = {
  hasError: boolean;
  errorKind: ErrorKind | null;
  recoveryAttempted: boolean;
};

function isUnauthenticatedError(error: unknown): boolean {
  return (
    error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null &&
    (error.data as Record<string, unknown>).code === "UNAUTHENTICATED"
  );
}

/**
 * Envuelve todo el contenido de app/(app)/layout.tsx (Sidebar,
 * ConnectionBanner, MobileTopBar, TabBar, {children}) para capturar errores
 * `UNAUTHENTICATED` (PRO-59) que app/(app)/error.tsx NO cubre: ese error.tsx
 * solo captura errores de {children} (page.tsx y sus hijos), nunca del
 * resto del shell — MobileTopBar en concreto ya consume una query
 * autenticada fuera de {children}. Nunca relanza: cualquier error de
 * {children} ya lo captura antes el error.tsx de la ruta (este boundary lo
 * envuelve por fuera, nunca llega a verlo primero) — en la práctica este
 * boundary solo llega a capturar errores del resto del shell.
 *
 * Como mucho un intento de recuperación automática por incidente — ver
 * componentDidCatch/componentDidUpdate más abajo para el porqué exacto.
 */
export class ConvexAuthErrorBoundary extends Component<{ children: ReactNode }, State> {
  static contextType = ConvexAccessTokenContext;
  declare context: ContextType<typeof ConvexAccessTokenContext>;

  state: State = { hasError: false, errorKind: null, recoveryAttempted: false };

  // Campo de instancia, NO estado de React: solo sirve para detectar un
  // cambio de token entre commits en componentDidUpdate — no debe disparar
  // un render por sí mismo.
  private lastSeenToken: string | undefined = undefined;

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { hasError: true, errorKind: isUnauthenticatedError(error) ? "auth" : "generic" };
  }

  // errorKind ya lo calculó getDerivedStateFromError — este método no
  // necesita leer `error`/`errorInfo` de nuevo, solo reaccionar al estado.
  componentDidCatch(): void {
    if (this.state.errorKind !== "auth") return;
    if (this.state.recoveryAttempted) {
      // Segundo fallo de autenticación consecutivo sin que un render
      // correcto llegara a confirmar el token intermedio (ver
      // componentDidUpdate, paso 2) — terminal, sin pedir un tercer token.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa intencional (ver ConvexAccessTokenProvider.tsx, mismo criterio)
      window.location.assign("/login");
      return;
    }
    this.setState({ recoveryAttempted: true });
    void this.context?.refresh();
  }

  componentDidUpdate(): void {
    const currentToken = this.context?.token;

    // Paso 1: el token cambió desde el último commit visto — intenta
    // renderizar otra vez con el nuevo, SIN tocar recoveryAttempted
    // todavía. Si este intento vuelve a lanzar, React lo captura de forma
    // síncrona dentro de este mismo ciclo de actualización, y
    // componentDidCatch debe seguir viendo recoveryAttempted en true para
    // tratarlo como el segundo fallo consecutivo, no como uno nuevo — por
    // eso este paso nunca toca esa marca.
    if (currentToken !== this.lastSeenToken) {
      this.lastSeenToken = currentToken;
      if (this.state.hasError && this.state.errorKind === "auth" && currentToken !== undefined) {
        this.setState({ hasError: false, errorKind: null });
      }
    }

    // Paso 2: separado del anterior a propósito. Solo se alcanza tras un
    // commit SIN error — si el intento del paso 1 hubiera vuelto a lanzar,
    // este componentDidUpdate ni siquiera llegaría a ejecutarse (React ya
    // estaría de vuelta en getDerivedStateFromError/componentDidCatch).
    // Certifica que el token nuevo funcionó de verdad, no solo que se
    // recibió — es lo que cierra el bucle.
    if (!this.state.hasError && this.state.recoveryAttempted) {
      this.setState({ recoveryAttempted: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.errorKind === "auth") {
      // Fallback mínimo, sin texto ni botón: se resuelve solo
      // (componentDidUpdate) o navega (componentDidCatch).
      return <div />;
    }
    if (this.state.hasError && this.state.errorKind === "generic") {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon="alert-circle"
            title="Algo ha fallado"
            message="Ha ocurrido un error inesperado."
            actionLabel="Reintentar"
            onAction={() => this.setState({ hasError: false, errorKind: null })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
