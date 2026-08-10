"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import { useAuthedMutation } from "@/lib/convex/authedHooks";
import type { Id } from "@/convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ORIGIN_CHANNEL_OPTIONS, type OriginChannel } from "@/lib/clientes/clientOptions";
import { clientFormErrorsFromConvexCode } from "@/lib/clientes/clientFormErrors";
import { validateNuevoClienteForm, type NuevoClienteFormErrors } from "@/lib/clientes/validateNuevoClienteForm";
import { convexErrorCode } from "@/lib/shared/convexError";

const FORM_ID = "editar-cliente-form";

type Touched = { name: boolean; phone: boolean; email: boolean; originChannel: boolean };
const NOTHING_TOUCHED: Touched = { name: false, phone: false, email: false, originChannel: false };

type Props = {
  clientId: Id<"clients">;
  name: string;
  phone?: string;
  email?: string;
  originChannel?: OriginChannel;
  onClose: () => void;
};

/**
 * Parcheo parcial: solo se envían a la mutation los campos que el usuario
 * tocó de verdad (`touched`), nunca los que quedaron igual porque nunca se
 * editaron. Los flags `touched` se marcan solo desde los `onChange` de los
 * campos — nunca se recalculan comparando contra las props `name`/`phone`/
 * `email`/`originChannel`, porque `FichaClienteScreen` mantiene una
 * suscripción reactiva al cliente: si otra sesión edita el cliente mientras
 * este overlay sigue abierto, esas props cambian sin desmontar el
 * componente, y comparar contra ellas en el envío reenviaría por error un
 * campo que el usuario nunca tocó, pisando el cambio ajeno.
 */
export function EditarClienteOverlay({ clientId, name: initialName, phone, email, originChannel, onClose }: Props) {
  const updateClient = useAuthedMutation(api.clients.update);
  const [name, setName] = useState(initialName);
  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [emailValue, setEmailValue] = useState(email ?? "");
  const [originChannelValue, setOriginChannelValue] = useState<OriginChannel>(originChannel ?? "web");
  const [touched, setTouched] = useState<Touched>(NOTHING_TOUCHED);
  const [errors, setErrors] = useState<NuevoClienteFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  // Cerrojo síncrono contra doble envío Y contra cerrar mientras se guarda
  // (ver handleClose) — mismo patrón que NuevoClienteScreen.tsx. `isSaving`
  // (estado de React) no sirve para esto último: no se aplica de forma
  // síncrona, así que Escape/backdrop/Cancelar podrían colarse en la
  // ventana entre marcar savingRef y el siguiente render.
  const savingRef = useRef(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

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
    if (field === "phone") setPhoneValue(value);
    if (field === "email") setEmailValue(value);

    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
    setErrors((prev) => {
      if (!prev[field] && !((field === "phone" || field === "email") && prev.form)) return prev;
      const next = { ...prev };
      delete next[field];
      if (field === "phone" || field === "email") delete next.form;
      return next;
    });
  }

  function handleOriginChannelChange(value: string) {
    setOriginChannelValue(value as OriginChannel);
    setTouched((prev) => (prev.originChannel ? prev : { ...prev, originChannel: true }));
  }

  function handleClose() {
    if (savingRef.current) return;
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;

    const nothingChanged = !touched.name && !touched.phone && !touched.email && !touched.originChannel;
    if (nothingChanged) {
      onClose();
      return;
    }

    const validation = validateNuevoClienteForm({ name, phone: phoneValue, email: emailValue });
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      await updateClient({
        clientId,
        name: touched.name ? name.trim() : undefined,
        phone: touched.phone ? phoneValue.trim() : undefined,
        email: touched.email ? emailValue.trim() : undefined,
        originChannel: touched.originChannel ? originChannelValue : undefined,
      });
      onClose();
    } catch (error) {
      setErrors(clientFormErrorsFromConvexCode(convexErrorCode(error)));
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <Overlay
      title="Editar cliente"
      onClose={handleClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" disabled={isSaving}>
            {isSaving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {errors.form && (
          <p ref={formErrorRef} role="alert" tabIndex={-1} className="font-caption text-error-text outline-none">
            {errors.form}
          </p>
        )}
        <Input
          ref={nameRef}
          label="Nombre"
          required
          value={name}
          onChange={(value) => updateField("name", value)}
          error={errors.name}
          disabled={isSaving}
          autoComplete="name"
        />
        <Input
          ref={phoneRef}
          label="Teléfono"
          value={phoneValue}
          onChange={(value) => updateField("phone", value)}
          error={errors.phone}
          disabled={isSaving}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
        />
        <Input
          ref={emailRef}
          label="Email"
          value={emailValue}
          onChange={(value) => updateField("email", value)}
          error={errors.email}
          disabled={isSaving}
          type="email"
          autoComplete="email"
        />
        <Select
          label="Canal de origen"
          value={originChannelValue}
          onChange={handleOriginChannelChange}
          options={ORIGIN_CHANNEL_OPTIONS}
          disabled={isSaving}
        />
      </form>
    </Overlay>
  );
}
