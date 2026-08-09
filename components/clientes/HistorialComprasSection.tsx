import type { Id } from "@/convex/_generated/dataModel";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatBusinessDate } from "@/lib/shared/businessDay";
import { formatCurrencyEUR } from "@/lib/shared/formatCurrency";

type Sale = { _id: Id<"sales">; description: string; amountCents: number; date: string };

// Deliberadamente de solo lectura: no hay ninguna acción de "registrar
// venta" aquí (PRO-17/23, fuera de alcance) — por eso estará siempre vacío
// en producción salvo por lo que siembre convex/seed.ts.
export function HistorialComprasSection({ items, truncated }: { items: Sale[]; truncated: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <h2 className="font-section-title m-0 text-text">Historial de compras</h2>

      {items.length === 0 ? (
        <EmptyState
          icon="wallet"
          title="Sin ventas"
          message="Todavía no se ha registrado ninguna compra de este cliente."
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((sale) => (
            <li
              key={sale._id}
              className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-none last:pb-0"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-text">{sale.description}</span>
                <span className="font-caption text-text-tertiary">{formatBusinessDate(sale.date)}</span>
              </div>
              <span className="font-body-medium text-text">{formatCurrencyEUR(sale.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}

      {truncated && <p className="font-caption m-0 text-text-tertiary">Mostrando las 500 compras más recientes.</p>}
    </div>
  );
}
