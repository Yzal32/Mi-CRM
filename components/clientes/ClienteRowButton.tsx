import { ClienteRowContent, type ClienteRowContentProps } from "./ClienteRowContent";

// Variante "botón" de ClienteRow para selectores (SeleccionarClienteOverlay):
// elegir la fila ES la acción, no navega a ningún sitio — por eso no lleva
// el chevrón final que sí lleva ClienteRow (esa flecha afirma "esto navega
// a otro sitio", cosa que aquí no pasa).
export function ClienteRowButton({ onClick, ...content }: { onClick: () => void } & ClienteRowContentProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3.5 rounded-lg border border-border bg-surface px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      <ClienteRowContent {...content} />
    </button>
  );
}
