"use client";

import { Overlay } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

type Props = {
  onClose: () => void;
  onSelectVenta: () => void;
  onSelectNota: () => void;
};

// Bottom-sheet solo-móvil: sustituye el "+" -> /clientes/nuevo directo que
// usan el resto de pestañas, porque en Hoy hay 3 acciones posibles, no 1.
export function HoyQuickActionsOverlay({ onClose, onSelectVenta, onSelectNota }: Props) {
  return (
    <Overlay title="Nueva acción" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {/* MobileTopBar no se desmonta al navegar (vive fuera de {children}
            en el layout) — sin cerrar aquí explícitamente, isSheetOpen se
            quedaría en true en memoria y el menú reaparecería solo al
            volver a Hoy. */}
        <Button href="/clientes/nuevo" variant="secondary" className="w-full" onClick={onClose}>
          <Icon name="plus" size={16} />
          Nuevo cliente
        </Button>
        <Button type="button" variant="secondary" className="w-full" onClick={onSelectVenta}>
          <Icon name="wallet" size={16} />
          Registrar venta
        </Button>
        <Button type="button" variant="secondary" className="w-full" onClick={onSelectNota}>
          <Icon name="pencil" size={16} />
          Anotar interacción
        </Button>
      </div>
    </Overlay>
  );
}
