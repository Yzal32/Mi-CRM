"use client";

import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { useAuthedQuery } from "@/lib/convex/authedHooks";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { deriveClientesViewState } from "@/lib/clientes/deriveClientesViewState";
import { SearchBar } from "@/components/ui/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ClienteRow } from "./ClienteRow";

export function ClientesScreen() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const search = debouncedQuery.trim() || undefined;
  const hasSearchTerm = Boolean(search);

  const data = useAuthedQuery(api.clients.search, search ? { search } : "skip");
  const state = deriveClientesViewState({ data, hasSearchTerm });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-4 lg:px-12 lg:py-10">
      <h1 className="hidden font-screen-title m-0 text-text lg:block">Clientes</h1>

      <SearchBar value={query} onChange={setQuery} placeholder="Buscar por nombre o teléfono" />

      {state === "idle" && (
        <EmptyState icon="search" title="Busca un cliente" message="Escribe el principio de un nombre o teléfono." />
      )}

      {state === "loading" && <Skeleton />}

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
            />
          ))}
        </div>
      )}
    </div>
  );
}
