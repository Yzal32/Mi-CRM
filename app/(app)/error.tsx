"use client";

import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Cubre errores de render de page.tsx y sus hijos (incluida HoyScreen) —
 * NO cubre errores lanzados por el propio app/(app)/layout.tsx (p. ej. si
 * Sidebar fallara al renderizar). Límite conocido, documentado en el plan.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        icon="alert-circle"
        title="Algo ha fallado"
        message={error.message || "Ha ocurrido un error inesperado."}
        actionLabel="Reintentar"
        onAction={reset}
      />
    </div>
  );
}
