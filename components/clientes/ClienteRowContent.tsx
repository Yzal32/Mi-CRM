import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { actionIcon, followUpLabel, type ActionType } from "@/lib/hoy/followUpPresentation";
import type { ClientStatus } from "@/lib/clientes/clientOptions";

export type ClienteRowContentProps = {
  name: string;
  phone?: string;
  status?: ClientStatus;
  followUp?: { actionType: ActionType; diffDays: number };
};

// Contenido visual compartido por ClienteRow (enlace a la ficha) y
// ClienteRowButton (selector) — deliberadamente sin el chevrón final: cada
// wrapper decide si lo añade, porque solo ClienteRow navega a otro sitio.
export function ClienteRowContent({ name, phone, status, followUp }: ClienteRowContentProps) {
  return (
    <>
      <Avatar name={name} size={44} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-body-medium text-text">{name}</span>
        {phone && <span className="font-secondary text-text-tertiary">{phone}</span>}
        {/* PRO-19: solo diffDays > 0 (atrasado de verdad) usa el color de
            alerta; hoy y futuro comparten el tono neutro. */}
        {followUp && (
          <div className={clsx("flex items-center gap-1.5", followUp.diffDays > 0 ? "text-alert-text" : "text-text-tertiary")}>
            <Icon name={actionIcon(followUp.actionType)} size={15} className="shrink-0" />
            <span className="font-secondary">{followUpLabel(followUp.actionType, followUp.diffDays)}</span>
          </div>
        )}
      </div>
      {/* Badge no acepta className — el shrink-0 va en este span envolvente
          para que un nombre largo no lo comprima. */}
      <span className="shrink-0">
        <Badge status={status ?? "new"} />
      </span>
    </>
  );
}
