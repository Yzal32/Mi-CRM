"use client";

import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { useAuthedQuery } from "@/lib/convex/authedHooks";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { deriveClientesViewState } from "@/lib/clientes/deriveClientesViewState";
import type { SelectedClient } from "@/lib/hoy/useClientActionFlow";
import { Overlay } from "@/components/ui/Overlay";
import { SearchBar } from "@/components/ui/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ClienteRowButton } from "./ClienteRowButton";

type Props = {
  title: string;
  today: string;
  onSelect: (client: SelectedClient) => void;
  onClose: () => void;
};

// Selector de cliente genérico (buscador + lista) — sin nada específico de
// Hoy, reutilizable por cualquier flujo que necesite "elegir un cliente"
// (p. ej. la futura pantalla Registrar venta, PRO-23). Elegir una fila ES
// la acción: sin footer, sin confirmación.
export function SeleccionarClienteOverlay({ title, today, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const search = debouncedQuery.trim() || undefined;
  const hasSearchTerm = Boolean(search);

  // Mismo patrón de doble-hook-con-"skip"-cruzado que ClientesScreen.tsx:
  // sin término se lista todo (clients.list); con término se filtra
  // (clients.search). Nunca los dos activos a la vez.
  const searchData = useAuthedQuery(api.clients.search, search ? { search, today } : "skip");
  const listData = useAuthedQuery(api.clients.list, search ? "skip" : { today });
  const data = search ? searchData : listData;
  const state = deriveClientesViewState({ data, hasSearchTerm });

  return (
    <Overlay title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <SearchBar value={query} onChange={setQuery} placeholder="Buscar por nombre o teléfono" />

        {state === "loading" && <Skeleton rows={4} />}

        {state === "empty" && (
          <EmptyState
            icon="users"
            title="Aún no tienes clientes"
            message="Añade tu primer cliente para poder elegirlo aquí."
            actionLabel="Añadir cliente"
            actionHref="/clientes/nuevo"
          />
        )}

        {state === "noResults" && (
          <EmptyState icon="search" title="Sin resultados" message="No hay ningún cliente que coincida con esa búsqueda." />
        )}

        {state === "hasResults" && data && (
          <div className="flex flex-col gap-2.5">
            {data.truncated && (
              <p className="font-secondary m-0 text-text-tertiary">
                Hay más clientes de los que se muestran aquí; afina la búsqueda.
              </p>
            )}
            {data.items.map((client) => (
              <ClienteRowButton
                key={client.clientId}
                name={client.name}
                phone={client.phone}
                status={client.status}
                followUp={client.followUp}
                onClick={() => onSelect({ clientId: client.clientId, name: client.name })}
              />
            ))}
          </div>
        )}
      </div>
    </Overlay>
  );
}
