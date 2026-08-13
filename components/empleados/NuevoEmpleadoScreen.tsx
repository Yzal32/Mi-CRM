"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { useAuthedMutation } from "@/lib/convex/authedHooks";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { validateNuevoEmpleadoForm, type NuevoEmpleadoFormErrors } from "@/lib/empleados/validateNuevoEmpleadoForm";

const GENERIC_SAVE_ERROR = "No se pudo guardar el empleado. Inténtalo de nuevo.";

function errorsFromConvexCode(code: string | undefined): NuevoEmpleadoFormErrors {
  switch (code) {
    case "DUPLICATE_EMAIL":
      return { email: "Ya hay una cuenta con ese email." };
    case "INVALID_EMAIL":
      return { email: "Ese email no es válido." };
    case "EMAIL_REQUIRED":
      return { email: "Introduce el email del empleado." };
    case "NAME_REQUIRED":
      return { name: "Introduce el nombre del empleado." };
    case "NAME_TOO_LONG":
      return { name: "El nombre es demasiado largo." };
    case "PASSWORD_REQUIRED":
      return { password: "Introduce una contraseña." };
    case "PASSWORD_TOO_SHORT":
      return { password: "La contraseña debe tener al menos 8 caracteres." };
    case "PASSWORD_TOO_LONG":
      return { password: "La contraseña es demasiado larga." };
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

export function NuevoEmpleadoScreen() {
  const router = useRouter();
  const createEmployee = useAuthedMutation(api.users.create);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<NuevoEmpleadoFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // Cerrojo síncrono contra doble envío — un useState no basta porque no se
  // actualiza de forma síncrona entre dos eventos de click muy seguidos.
  const savingRef = useRef(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  // Enfoca el primer campo con error después de que React lo pinte, no en
  // la misma pasada síncrona que setErrors (el elemento aún no tendría sus
  // atributos actualizados).
  useEffect(() => {
    if (errors.name) {
      nameRef.current?.focus();
    } else if (errors.email) {
      emailRef.current?.focus();
    } else if (errors.password) {
      passwordRef.current?.focus();
    } else if (errors.form) {
      formErrorRef.current?.focus();
    }
  }, [errors]);

  function updateField(field: "name" | "email" | "password", value: string) {
    if (field === "name") setName(value);
    if (field === "email") setEmail(value);
    if (field === "password") setPassword(value);

    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;

    const validation = validateNuevoEmpleadoForm({ name, email, password });
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    try {
      await createEmployee({ name: name.trim(), email: email.trim(), password });
      // No hay todavía ficha ni listado de empleados (eso es PRO-51):
      // Ajustes es el destino más cercano hoy y ya menciona "Gestión de
      // empleados" en su placeholder. router.replace, no push: "Nuevo
      // empleado" no debe quedar en el historial.
      router.replace("/ajustes");
    } catch (error) {
      setErrors(errorsFromConvexCode(convexErrorCode(error)));
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-4 lg:px-12 lg:py-10">
      <div className="hidden items-center gap-3 lg:flex">
        <IconButton icon="arrow-left" label="Volver a ajustes" variant="secondary" onClick={() => router.back()} />
        <h1 className="font-screen-title m-0 text-text">Nuevo empleado</h1>
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
          ref={nameRef}
          label="Nombre"
          required
          value={name}
          onChange={(value) => updateField("name", value)}
          error={errors.name}
          placeholder="Nombre del empleado"
          autoComplete="name"
        />

        <Input
          ref={emailRef}
          label="Email"
          required
          value={email}
          onChange={(value) => updateField("email", value)}
          error={errors.email}
          type="email"
          placeholder="correo@ejemplo.com"
          autoComplete="email"
        />

        <Input
          ref={passwordRef}
          label="Contraseña inicial"
          required
          value={password}
          onChange={(value) => updateField("password", value)}
          error={errors.password}
          type="password"
          autoComplete="new-password"
        />

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
