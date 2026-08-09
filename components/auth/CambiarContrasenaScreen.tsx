"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { logoutAction } from "@/lib/auth/actions";
import { changePasswordAction } from "@/app/cambiar-contrasena/actions";

type FieldErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmNewPassword?: string;
  form?: string;
};

const GENERIC_ERROR = "No se pudo cambiar la contraseña. Inténtalo de nuevo.";

function errorsFromCode(code: string): FieldErrors {
  switch (code) {
    case "CURRENT_PASSWORD_INCORRECT":
      return { currentPassword: "La contraseña actual no es correcta." };
    case "PASSWORD_UNCHANGED":
      return { newPassword: "La nueva contraseña debe ser distinta de la actual." };
    case "PASSWORD_TOO_SHORT":
      return { newPassword: "La contraseña debe tener al menos 8 caracteres." };
    case "PASSWORD_TOO_LONG":
      return { newPassword: "La contraseña es demasiado larga." };
    case "PASSWORD_REQUIRED":
      return { newPassword: "Introduce una contraseña nueva." };
    default:
      return { form: GENERIC_ERROR };
  }
}

export function CambiarContrasenaScreen({ mandatory }: { mandatory: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const savingRef = useRef(false);
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmNewPasswordRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (errors.currentPassword) {
      currentPasswordRef.current?.focus();
    } else if (errors.newPassword) {
      newPasswordRef.current?.focus();
    } else if (errors.confirmNewPassword) {
      confirmNewPasswordRef.current?.focus();
    } else if (errors.form) {
      formErrorRef.current?.focus();
    }
  }, [errors]);

  function updateField(field: "currentPassword" | "newPassword" | "confirmNewPassword", value: string) {
    if (field === "currentPassword") setCurrentPassword(value);
    if (field === "newPassword") setNewPassword(value);
    if (field === "confirmNewPassword") setConfirmNewPassword(value);

    setErrors((prev) => {
      if (!prev[field] && !prev.form) return prev;
      const next = { ...prev };
      delete next[field];
      delete next.form;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;

    const validation: FieldErrors = {};
    if (!currentPassword) validation.currentPassword = "Introduce tu contraseña actual.";
    if (!newPassword) validation.newPassword = "Introduce una contraseña nueva.";
    if (newPassword && confirmNewPassword && newPassword !== confirmNewPassword) {
      validation.confirmNewPassword = "Las contraseñas no coinciden.";
    }
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setErrors({});

    // Con un cambio correcto, changePasswordAction hace redirect() por
    // dentro (lanza — no vuelve aquí). Solo llegamos a leer `result` cuando
    // falla.
    const result = await changePasswordAction({ currentPassword, newPassword });
    if (result?.error) {
      setErrors(errorsFromCode(result.error));
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 px-4 py-10">
      <div>
        <h1 className="font-screen-title m-0 text-text">Cambiar contraseña</h1>
        <p className="font-body m-0 text-text-secondary">
          {mandatory
            ? "Debes actualizar tu contraseña antes de continuar."
            : "Cambia tu contraseña cuando quieras."}
        </p>
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
          ref={currentPasswordRef}
          label="Contraseña actual"
          required
          value={currentPassword}
          onChange={(value) => updateField("currentPassword", value)}
          error={errors.currentPassword}
          type="password"
          autoComplete="current-password"
        />

        <Input
          ref={newPasswordRef}
          label="Contraseña nueva"
          required
          value={newPassword}
          onChange={(value) => updateField("newPassword", value)}
          error={errors.newPassword}
          type="password"
          autoComplete="new-password"
        />

        <Input
          ref={confirmNewPasswordRef}
          label="Confirmar contraseña nueva"
          required
          value={confirmNewPassword}
          onChange={(value) => updateField("confirmNewPassword", value)}
          error={errors.confirmNewPassword}
          type="password"
          autoComplete="new-password"
        />

        <Button type="submit" variant="primary" disabled={isSaving} className="w-full">
          {isSaving ? "Guardando…" : "Guardar"}
        </Button>
      </form>

      <form action={logoutAction}>
        <Button type="submit" variant="secondary" className="w-full">
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
