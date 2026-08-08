"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBusinessToday } from "@/lib/hoy/useBusinessToday";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { deriveHoyViewState } from "@/lib/hoy/deriveHoyViewState";
import { SearchBar } from "@/components/ui/SearchBar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { FollowUpGroup } from "./FollowUpGroup";

export function HoyScreen() {
  const [query, setQuery] = useState("");
  const today = useBusinessToday();
  const debouncedQuery = useDebouncedValue(query, 250);
  const search = debouncedQuery.trim() || undefined;

  const data = useQuery(api.followUps.listToday, { today, search });
  const hasSearchTerm = Boolean(search);
  const state = deriveHoyViewState({ data, hasSearchTerm });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-4 lg:px-12 lg:py-10">
      <div className="hidden items-center justify-between lg:flex">
        <h1 className="font-screen-title m-0 text-text">Hoy</h1>
        <Button href="/clientes/nuevo" variant="primary">
          <Icon name="plus" size={16} />
          Nuevo cliente
        </Button>
      </div>

      <SearchBar value={query} onChange={setQuery} placeholder="Buscar cliente" />

      {state === "loading" && <Skeleton />}

      {state === "allCaughtUp" && (
        <EmptyState
          icon="calendar-check"
          title="¡Estás al día!"
          message="No tienes seguimientos pendientes por ahora."
          actionLabel="Ver lista de clientes"
          actionHref="/clientes"
        />
      )}

      {state === "noResults" && (
        <EmptyState icon="search" title="Sin resultados" message="No hay ningún cliente que coincida con esa búsqueda." />
      )}

      {state === "possiblyMoreMatches" && (
        <EmptyState
          icon="search"
          title="Puede haber más"
          message="No hay coincidencias entre los resultados mostrados; puede haber más."
        />
      )}

      {state === "hasData" && data && (
        <div className="flex flex-col gap-5">
          {data.overdueTruncated && (
            <p className="font-secondary m-0 text-alert-text">Hay más atrasados de los que se muestran aquí.</p>
          )}
          <FollowUpGroup label={`Atrasados (${data.overdue.length})`} tone="overdue" items={data.overdue} />
          {data.todayTruncated && (
            <p className="font-secondary m-0 text-text-tertiary">Hay más seguimientos de hoy de los que se muestran aquí.</p>
          )}
          <FollowUpGroup label={`Hoy (${data.today.length})`} tone="today" items={data.today} />
        </div>
      )}
    </div>
  );
}
