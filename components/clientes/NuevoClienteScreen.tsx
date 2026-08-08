"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ORIGIN_CHANNEL_OPTIONS, STATUS_OPTIONS, type ClientStatus, type OriginChannel } from "@/lib/clientes/clientOptions";
import { validateNuevoClienteForm, type NuevoClienteFormErrors } from "@/lib/clientes/validateNuevoClienteForm";

const GENERIC_SAVE_ERROR = "No se pudo guardar el cliente. Inténtalo de nuevo.";

function errorsFromConvexCode(code: string | undefined): NuevoClienteFormErrors {
  switch (code) {
    case "DUPLICATE_PHONE":
      return { phone: "Ya existe un cliente con este teléfono." };
    case "INVALID_PHONE":
      return { phone: "Ese teléfono no es válido." };
    case "INVALID_EMAIL":
      return { email: "Ese email no es válido." };
    case "NAME_REQUIRED":
      return { name: "Introduce el nombre del cliente." };
    case "NAME_TOO_LONG":
      return { name: "El nombre es demasiado largo." };
    case "CONTACT_REQUIRED":
      return { form: "Necesitas al menos un teléfono o un email para guardar el cliente." };
    default:
      return { form: GENERIC_SAVE_ERROR };
  }
}

function convexErrorCode(error: unknown): string | undefined {
  if (
    error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null &&
    typeof (error.data as Record<string, unknown>).code === "string"
  ) {
    return (error.data as Record<string, unknown>).code as string;
  }
  return undefined;
}

export function NuevoClienteScreen() {
  const router = useRouter();
  const createClient = useMutation(api.clients.create);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [originChannel, setOriginChannel] = useState<OriginChannel>("web");
  const [status, setStatus] = useState<ClientStatus>("new");
  const [errors, setErrors] = useState<NuevoClienteFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // Cerrojo síncrono contra doble envío — un useState no basta porque no se
  // actualiza de forma síncrona entre dos eventos de click muy seguidos.
  const savingRef = useRef(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  // Enfoca el primer campo con error después de que React lo pinte, no en
  // la misma pasada síncrona que setErrors (el elemento aún no tendría sus
  // atributos actualizados).
  useEffect(() => {
    if (errors.name) {
      nameRef.current?.focus();
    } else if (errors.phone) {
      phoneRef.current?.focus();
    } else if (errors.email) {
      emailRef.current?.focus();
    } else if (errors.form) {
      formErrorRef.current?.focus();
    }
  }, [errors]);

  function updateField(field: "name" | "phone" | "email", value: string) {
    if (field === "name") setName(value);
    if (field === "phone") setPhone(value);
    if (field === "email") setEmail(value);

    setErrors((prev) => {
      if (!prev[field] && !((field === "phone" || field === "email") && prev.form)) return prev;
      const next = { ...prev };
      delete next[field];
      if (field === "phone" || field === "email") delete next.form;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;

    const validation = validateNuevoClienteForm({ name, phone, email });
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    try {
      const clientId = await createClient({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        originChannel,
        status,
      });
      // router.replace, no push: si guardáramos con push, "Nuevo cliente" se
      // quedaría en el historial y volver atrás desde la ficha lo mostraría
      // relleno otra vez. El cerrojo se mantiene marcado hasta aquí — la
      // pantalla desaparece justo después, no hace falta liberarlo.
      router.replace(`/clientes/${clientId}`);
    } catch (error) {
      setErrors(errorsFromConvexCode(convexErrorCode(error)));
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-4 lg:px-12 lg:py-10">
      <div className="hidden items-center gap-3 lg:flex">
        <IconButton icon="arrow-left" label="Volver a clientes" variant="secondary" onClick={() => router.back()} />
        <h1 className="font-screen-title m-0 text-text">Nuevo cliente</h1>
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

        <div className="flex flex-col gap-3.5 lg:flex-row">
          <div className="flex-1">
            <Input
              ref={nameRef}
              label="Nombre"
              required
              value={name}
              onChange={(value) => updateField("name", value)}
              error={errors.name}
              placeholder="Nombre del cliente"
              autoComplete="name"
            />
          </div>
          <div className="flex-1">
            <Input
              ref={phoneRef}
              label="Teléfono"
              value={phone}
              onChange={(value) => updateField("phone", value)}
              error={errors.phone}
              type="tel"
              inputMode="tel"
              placeholder="622 334 556"
              autoComplete="tel"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="font-caption uppercase tracking-wide text-text-tertiary">Opcional</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Input
          ref={emailRef}
          label="Email"
          value={email}
          onChange={(value) => updateField("email", value)}
          error={errors.email}
          type="email"
          placeholder="correo@ejemplo.com"
          autoComplete="email"
        />

        <div className="flex flex-col gap-3.5 lg:flex-row">
          <div className="flex-1">
            <Select
              label="Canal de origen"
              value={originChannel}
              onChange={(value) => setOriginChannel(value as OriginChannel)}
              options={ORIGIN_CHANNEL_OPTIONS}
            />
          </div>
          <div className="flex-1">
            <Select
              label="Estado"
              value={status}
              onChange={(value) => setStatus(value as ClientStatus)}
              options={STATUS_OPTIONS}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <div className="hidden lg:block">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>
          <Button type="submit" variant="primary" disabled={isSaving} className="w-full lg:w-auto">
            {isSaving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
