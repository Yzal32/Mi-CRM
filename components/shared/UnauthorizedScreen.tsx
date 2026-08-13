import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Pantalla a página completa para rutas restringidas por rol (hoy solo
 * `/empleados/nuevo`, PRO-46) — cada página la renderiza en el sitio (misma
 * URL) cuando `user.role` no cumple, en vez de redirigir a otra ruta:
 *   if (user.role !== "owner") return <UnauthorizedScreen />;
 * No hay helper de guard reusable del lado Next (a diferencia de
 * `requireOwner` en Convex): con esta comparación de una línea no aporta
 * nada envolverla. Revisar si Next saca `forbidden()`/`unauthorized()`
 * (existen ya tras `experimental.authInterrupts`, no activado en este
 * proyecto) de experimental — daría un 403 real y un único punto por app
 * en vez de este componente repetido por página.
 */
export function UnauthorizedScreen() {
  // min-h-full, no flex-1: el padre real en tiempo de ejecución es <main>
  // (app/(app)/layout.tsx), que NO es un contenedor flex (solo es un ítem
  // flex de su propio padre) — flex-1 aquí no tendría ningún efecto. main
  // sí tiene una altura definida (se estira dentro de la columna flex de
  // más arriba), así que min-h-full sobre este div funciona para centrar
  // verticalmente a página completa.
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <EmptyState
        icon="alert-circle"
        title="No autorizado"
        message="Esta sección solo está disponible para la cuenta de la Dueña."
        actionLabel="Volver a Hoy"
        actionHref="/"
      />
    </div>
  );
}
