"use client";

import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { useAuthedQuery } from "@/lib/convex/authedHooks";
import { useBusinessToday } from "@/lib/hoy/useBusinessToday";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { deriveClientesViewState } from "@/lib/clientes/deriveClientesViewState";
import { SearchBar } from "@/components/ui/SearchBar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ClienteRow } from "./ClienteRow";

export function ClientesScreen() {
  const [query, setQuery] = useState("");
  const today = useBusinessToday();
  const debouncedQuery = useDebouncedValue(query, 250);
  const search = debouncedQuery.trim() || undefined;
  const hasSearchTerm = Boolean(search);

  // PRO-19: dos hooks siempre montados, "skip" cruzado según haya término —
  // sin término se lista todo (clients.list); con término se filtra
  // (clients.search). Nunca los dos activos a la vez.
  const searchData = useAuthedQuery(api.clients.search, search ? { search, today } : "skip");
  const listData = useAuthedQuery(api.clients.list, search ? "skip" : { today });
  const data = search ? searchData : listData;
  const state = deriveClientesViewState({ data, hasSearchTerm });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-4 lg:px-12 lg:py-10">
      <div className="hidden items-center justify-between lg:flex">
        <h1 className="font-screen-title m-0 text-text">Clientes</h1>
        <Button href="/clientes/nuevo" variant="primary">
          <Icon name="plus" size={16} />
          Nuevo cliente
        </Button>
      </div>

      <SearchBar value={query} onChange={setQuery} placeholder="Buscar por nombre o teléfono" />

      {(state === "noResults" || state === "hasResults") && data && (
        <p className="font-secondary m-0 text-text-tertiary">
          {`${data.truncated ? `${data.items.length}+` : data.items.length} ${hasSearchTerm ? "resultados" : "clientes"}`}
        </p>
      )}

      {state === "loading" && <Skeleton />}

      {state === "empty" && (
        <EmptyState
          icon="users"
          title="Aún no tienes clientes"
          message="Añade tu primer cliente para empezar a hacer seguimiento."
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
            <p className="font-secondary m-0 text-text-tertiary">Hay más clientes de los que se muestran aquí; afina la búsqueda.</p>
          )}
          {data.items.map((client) => (
            <ClienteRow
              key={client.clientId}
              clientId={client.clientId}
              name={client.name}
              phone={client.phone}
              status={client.status}
              followUp={client.followUp}
            />
          ))}
        </div>
      )}
    </div>
  );
}
