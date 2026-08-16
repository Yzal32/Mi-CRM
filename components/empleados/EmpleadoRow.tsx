"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";

export type Employee = {
  _id: Id<"users">;
  name: string;
  email: string;
  status: "active" | "inactive";
};

export function EmpleadoRow({
  employee,
  busy,
  onDeactivate,
  onReactivate,
}: {
  employee: Employee;
  busy: boolean;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const isActive = employee.status === "active";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-body-medium text-text">{employee.name}</span>
        <span className="font-secondary text-text-tertiary">{employee.email}</span>
        <span className={`font-secondary ${isActive ? "text-text-secondary" : "text-error-text"}`}>
          {isActive ? "Activo" : "Inactivo"}
        </span>
      </div>
      <Button type="button" variant="secondary" disabled={busy} onClick={isActive ? onDeactivate : onReactivate}>
        {busy ? "…" : isActive ? "Quitar acceso" : "Reactivar"}
      </Button>
    </div>
  );
}
