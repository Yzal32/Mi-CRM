import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatBusinessDate } from "@/lib/shared/businessDay";
import { formatCurrencyEUR } from "@/lib/shared/formatCurrency";

type Sale = { _id: Id<"sales">; description: string; amountCents: number; date: string };

type Props = { clientId: string; items: Sale[]; truncated: boolean };

export function HistorialComprasSection({ clientId, items, truncated }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-section-title m-0 text-text">Historial de compras</h2>
        <Button href={`/clientes/${clientId}/venta`} variant="ghost" size="sm" className="lg:hidden">
          + Registrar venta
        </Button>
      </div>

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
