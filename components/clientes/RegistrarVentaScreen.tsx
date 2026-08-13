"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useAuthedMutation, useAuthedQuery } from "@/lib/convex/authedHooks";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBusinessToday } from "@/lib/hoy/useBusinessToday";
import { formatBusinessDate } from "@/lib/shared/businessDay";
import { parseCurrencyEUR } from "@/lib/shared/formatCurrency";
import { convexErrorCode } from "@/lib/shared/convexError";
import { validateRegistrarVentaForm, type RegistrarVentaFormErrors } from "@/lib/clientes/validateRegistrarVentaForm";

const GENERIC_SAVE_ERROR = "No se pudo guardar la venta. Inténtalo de nuevo.";

type FormErrors = RegistrarVentaFormErrors & { form?: string };

function errorsFromConvexCode(code: string | undefined): FormErrors {
  switch (code) {
    case "DESCRIPTION_REQUIRED":
      return { description: "Describe qué se ha vendido." };
    case "DESCRIPTION_TOO_LONG":
      return { description: "La descripción es demasiado larga." };
    case "INVALID_AMOUNT":
      return { amount: "Introduce un importe válido." };
    case "CLIENT_NOT_FOUND":
      // Carrera plausible viniendo del selector de "Hoy" (PRO-60): el
      // cliente se borra entre abrir esta pantalla y guardar. La venta no
      // se ha creado; el banner lo deja explícito.
      return { form: "Este cliente ya no existe." };
    default:
      return { form: GENERIC_SAVE_ERROR };
  }
}

export function RegistrarVentaScreen({ clientId }: { clientId: string }) {
  const router = useRouter();
  const client = useAuthedQuery(api.clients.getById, { clientId });
  const createSale = useAuthedMutation(api.sales.create);
  const today = useBusinessToday();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // Cerrojo síncrono contra doble envío — igual patrón que NuevoClienteScreen.
  const savingRef = useRef(false);

  const descriptionRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (errors.description) {
      descriptionRef.current?.focus();
    } else if (errors.amount) {
      amountRef.current?.focus();
    } else if (errors.form) {
      formErrorRef.current?.focus();
    }
  }, [errors]);

  function updateField(field: "description" | "amount", value: string) {
    if (field === "description") setDescription(value);
    if (field === "amount") setAmount(value);

    setErrors((prev) => {
      if (!prev[field] && !prev.form) return prev;
      const next = { ...prev };
      delete next[field];
      // El banner general (error de red o CLIENT_NOT_FOUND) también se
      // limpia al tocar cualquier campo: es la señal de que el usuario está
      // reintentando, y dejarlo fijo hasta el siguiente guardado mostraría
      // un mensaje obsoleto mientras corrige.
      delete next.form;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current || !client) return;

    const validation = validateRegistrarVentaForm({ description, amount });
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    try {
      await createSale({
        clientId: client._id,
        description: description.trim(),
        amountCents: parseCurrencyEUR(amount)!,
      });
      // router.replace, no push: si guardáramos con push, "Registrar venta"
      // se quedaría en el historial y volver atrás desde la ficha lo
      // mostraría relleno otra vez.
      router.replace(`/clientes/${clientId}`);
    } catch (error) {
      setErrors(errorsFromConvexCode(convexErrorCode(error)));
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  if (client === undefined) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-4 lg:px-12 lg:py-10">
        <Skeleton rows={3} />
      </div>
    );
  }

  if (client === null) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-4 lg:px-12 lg:py-10">
        <EmptyState
          icon="alert-circle"
          title="Cliente no encontrado"
          message="Puede que el enlace esté mal o que el cliente se haya eliminado."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-4 lg:px-12 lg:py-10">
      <div className="hidden items-center gap-3 lg:flex">
        <IconButton icon="arrow-left" label="Volver a la ficha" variant="secondary" onClick={() => router.back()} />
        <h1 className="font-screen-title m-0 text-text">Registrar venta</h1>
      </div>

      <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface px-4 py-3">
        <span className="font-caption text-text-tertiary">Cliente</span>
        <span className="font-body-medium text-text">{client.name}</span>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {errors.form && (
          <p
            ref={formErrorRef}
            role="alert"
            tabIndex={-1}
            className="flex items-start gap-2.5 rounded-md border border-error-border bg-error-bg px-3.5 py-3 font-secondary text-error-text outline-none"
          >
            <Icon name="alert-circle" size={18} className="mt-0.5 shrink-0" />
            {errors.form}
          </p>
        )}

        <Input
          ref={descriptionRef}
          label="Descripción"
          required
          value={description}
          onChange={(value) => updateField("description", value)}
          error={errors.description}
          placeholder="Qué se ha vendido"
        />

        <Input
          ref={amountRef}
          label="Importe (€)"
          required
          value={amount}
          onChange={(value) => updateField("amount", value)}
          error={errors.amount}
          inputMode="decimal"
          placeholder="0,00"
        />

        <div className="flex flex-col gap-1.5">
          <span className="font-caption text-text-secondary">Fecha de registro</span>
          <span className="font-body text-text">{formatBusinessDate(today)}</span>
        </div>

        <div className="flex justify-end gap-3">
          <div className="hidden lg:block">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>
          <Button type="submit" variant="primary" disabled={isSaving} className="w-full lg:w-auto">
            {isSaving ? "Guardando…" : "Guardar venta"}
          </Button>
        </div>
      </form>
    </div>
  );
}
