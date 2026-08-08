function SkeletonRow() {
  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="h-11 w-11 shrink-0 animate-pulse rounded-circle bg-surface-sunken" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-4 w-2/5 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-3 w-3/5 animate-pulse rounded-sm bg-surface-sunken" />
      </div>
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5" role="status" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
