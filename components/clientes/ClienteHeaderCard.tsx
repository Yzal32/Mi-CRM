"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { DetailRow } from "@/components/ui/DetailRow";
import {
  ORIGIN_CHANNEL_OPTIONS,
  STATUS_OPTIONS,
  type ClientStatus,
  type OriginChannel,
} from "@/lib/clientes/clientOptions";
import { convexErrorCode } from "@/lib/shared/convexError";

const ORIGIN_CHANNEL_LABELS: Record<OriginChannel, string> = Object.fromEntries(
  ORIGIN_CHANNEL_OPTIONS.map((option) => [option.value, option.label]),
) as Record<OriginChannel, string>;

type Client = {
  _id: Id<"clients">;
  name: string;
  phone?: string;
  email?: string;
  originChannel?: OriginChannel;
  status?: ClientStatus;
};

export function ClienteHeaderCard({ client }: { client: Client }) {
  const updateStatus = useMutation(api.clients.updateStatus);
  const [pendingStatus, setPendingStatus] = useState<ClientStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  // Cerrojo síncrono además del `disabled` del select — React no lo aplica
  // a tiempo entre dos cambios muy seguidos.
  const lockRef = useRef(false);

  // Normalización legacy: phone/email/originChannel/status son opcionales
  // por contrato en convex/schema.ts — se muestran con el mismo valor por
  // defecto que createClient aplica al escribir.
  const displayedStatus = pendingStatus ?? client.status ?? "new";
  const originChannel = client.originChannel ?? "web";

  async function handleStatusChange(next: string) {
    if (lockRef.current) return;
    const status = next as ClientStatus;
    lockRef.current = true;
    setStatusError(null);
    setPendingStatus(status);
    try {
      await updateStatus({ clientId: client._id, status });
    } catch (error) {
      setStatusError(
        convexErrorCode(error) === "CLIENT_NOT_FOUND"
          ? "Este cliente ya no existe."
          : "No se pudo cambiar el estado. Inténtalo de nuevo.",
      );
    } finally {
      // Se libera siempre al resolver (éxito o error) — nunca condicionado
      // a que la query alcance exactamente el valor pedido: con dos
      // sesiones cambiando el estado casi a la vez, la reactividad puede
      // "saltarse" el valor solicitado, y depender de verlo dejaría esto
      // bloqueado para siempre.
      setPendingStatus(null);
      lockRef.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center gap-3.5">
        <Avatar name={client.name} size={56} />
        <div className="flex flex-1 flex-col gap-1.5">
          {/* h2, no h1: FichaClienteScreen ya tiene su propio <h1> de página. */}
          <h2 className="font-screen-title m-0 text-text">{client.name}</h2>
          <div className="flex items-center gap-2">
            <Badge status={displayedStatus} />
            <Select
              label="Cambiar estado"
              hideLabel
              value={displayedStatus}
              onChange={handleStatusChange}
              options={STATUS_OPTIONS}
              disabled={pendingStatus !== null}
            />
          </div>
        </div>
      </div>

      {statusError && (
        <p role="alert" className="font-caption text-error-text">
          {statusError}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {client.phone && <DetailRow icon="phone" label="Teléfono" value={client.phone} />}
        {client.email && <DetailRow icon="mail" label="Email" value={client.email} />}
        <DetailRow
          icon="map-pin"
          label="Canal de origen"
          value={`Llegó por: ${ORIGIN_CHANNEL_LABELS[originChannel]}`}
        />
      </div>
    </div>
  );
}
