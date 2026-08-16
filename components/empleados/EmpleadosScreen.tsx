"use client";

import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuthedMutation, useAuthedQuery } from "@/lib/convex/authedHooks";
import { convexErrorCode } from "@/lib/shared/convexError";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmpleadoRow, type Employee } from "./EmpleadoRow";

const GENERIC_ERROR = "No se pudo actualizar el acceso. Inténtalo de nuevo.";

export function EmpleadosScreen() {
  const employees = useAuthedQuery(api.users.listEmployees, {});
  const deactivateEmployee = useAuthedMutation(api.users.deactivateEmployee);
  const reactivateEmployee = useAuthedMutation(api.users.reactivateEmployee);
  const changeEmployeeRole = useAuthedMutation(api.users.changeEmployeeRole);

  const [busyId, setBusyId] = useState<Id<"users"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDeactivate(employee: Employee) {
    if (busyId) return;
    if (!window.confirm(`¿Quitar el acceso a ${employee.name}? Podrás reactivarlo cuando quieras.`)) return;
    setError(null);
    setBusyId(employee._id);
    try {
      await deactivateEmployee({ userId: employee._id });
    } catch (err) {
      setError(convexErrorCode(err) === "NOT_AN_EMPLOYEE" ? "Esa cuenta ya no es de un empleado." : GENERIC_ERROR);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReactivate(employee: Employee) {
    if (busyId) return;
    setError(null);
    setBusyId(employee._id);
    try {
      await reactivateEmployee({ userId: employee._id });
    } catch (err) {
      setError(convexErrorCode(err) === "NOT_AN_EMPLOYEE" ? "Esa cuenta ya no es de un empleado." : GENERIC_ERROR);
    } finally {
      setBusyId(null);
    }
  }

  async function handlePromote(employee: Employee) {
    if (busyId) return;
    if (!window.confirm(`¿Convertir a ${employee.name} en Administradora? Tendrá acceso completo, incluida la gestión de empleados.`))
      return;
    setError(null);
    setBusyId(employee._id);
    try {
      await changeEmployeeRole({ userId: employee._id, role: "owner" });
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-4 lg:px-12 lg:py-10">
      <div className="hidden items-center justify-between lg:flex">
        <h1 className="font-screen-title m-0 text-text">Empleados</h1>
        <Button href="/empleados/nuevo" variant="primary">
          <Icon name="plus" size={16} />
          Nuevo empleado
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-error-border bg-error-bg px-3.5 py-3 font-secondary text-error-text"
        >
          <Icon name="alert-circle" size={18} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {employees === undefined && <Skeleton />}

      {employees?.length === 0 && (
        <EmptyState
          icon="users"
          title="Aún no tienes empleados"
          message="Da de alta a tu primer empleado para que pueda acceder al CRM."
          actionLabel="Nuevo empleado"
          actionHref="/empleados/nuevo"
        />
      )}

      {employees && employees.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {employees.map((employee) => (
            <EmpleadoRow
              key={employee._id}
              employee={employee}
              busy={busyId === employee._id}
              onDeactivate={() => handleDeactivate(employee)}
              onReactivate={() => handleReactivate(employee)}
              onPromote={() => handlePromote(employee)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
