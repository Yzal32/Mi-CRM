"use client";

import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useAuthedQuery } from "@/lib/convex/authedHooks";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBusinessToday } from "@/lib/hoy/useBusinessToday";
import { deriveFichaViewState } from "@/lib/clientes/deriveFichaViewState";
import { ClienteHeaderCard } from "./ClienteHeaderCard";
import { NotaDestacadaCard } from "./NotaDestacadaCard";
import { SeguimientoCard } from "./SeguimientoCard";
import { NotasSection } from "./NotasSection";
import { HistorialComprasSection } from "./HistorialComprasSection";

export function FichaClienteScreen({ clientId }: { clientId: string }) {
  const router = useRouter();
  // clientId llega como string plano de la URL — clients.getById lo
  // normaliza en servidor (ctx.db.normalizeId); un ID malformado y uno
  // válido pero borrado producen el mismo resultado (null).
  const client = useAuthedQuery(api.clients.getById, { clientId });
  const viewState = deriveFichaViewState(client);

  // Las tres queries dependientes se lanzan con "skip" hasta tener un
  // client._id real — nunca con el string crudo de la URL, que revienta
  // su validador v.id("clients") si es malformado.
  const notes = useAuthedQuery(api.notes.listByClient, client ? { clientId: client._id } : "skip");
  const sales = useAuthedQuery(api.sales.listByClient, client ? { clientId: client._id } : "skip");
  const followUp = useAuthedQuery(api.followUps.getByClient, client ? { clientId: client._id } : "skip");
  const today = useBusinessToday();

  // Un único estado de carga derivado: el Skeleton se mantiene hasta que
  // TODAS las queries relevantes han resuelto, no solo la del cliente —
  // evita que las tarjetas parpadeen con datos vacíos mientras notes/sales/
  // followUp siguen en vuelo tras resolverse el cliente.
  const isReady = viewState === "ready" && notes !== undefined && sales !== undefined && followUp !== undefined;
  const showSkeleton = viewState === "loading" || (viewState === "ready" && !isReady);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-4 lg:px-12 lg:py-10">
      <div className="hidden items-center gap-3 lg:flex">
        <IconButton icon="arrow-left" label="Volver" variant="secondary" onClick={() => router.back()} />
        <h1 className="font-screen-title m-0 flex-1 text-text">{client?.name ?? "Cliente"}</h1>
        <Button href={`/clientes/${clientId}/venta`} variant="ghost" size="sm">
          + Registrar venta
        </Button>
      </div>

      {showSkeleton && <Skeleton rows={5} />}

      {viewState === "notFound" && (
        <EmptyState
          icon="alert-circle"
          title="Cliente no encontrado"
          message="Puede que el enlace esté mal o que el cliente se haya eliminado."
        />
      )}

      {isReady && client && (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[360px_1fr] lg:items-start lg:gap-5">
          <div className="flex flex-col gap-4">
            <ClienteHeaderCard client={client} />
            {notes?.featured && <NotaDestacadaCard note={notes.featured} />}
            <SeguimientoCard clientId={client._id} followUp={followUp ?? null} today={today} />
          </div>
          <div className="flex flex-col gap-4">
            <NotasSection
              clientId={client._id}
              featured={notes?.featured ?? null}
              items={notes?.items ?? []}
              truncated={notes?.truncated ?? false}
            />
            <HistorialComprasSection clientId={clientId} items={sales?.items ?? []} truncated={sales?.truncated ?? false} />
          </div>
        </div>
      )}
    </div>
  );
}
