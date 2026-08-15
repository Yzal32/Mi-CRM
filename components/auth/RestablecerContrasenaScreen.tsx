"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { resetPasswordAction } from "@/app/restablecer-contrasena/[token]/actions";

type FieldErrors = {
  newPassword?: string;
  confirmNewPassword?: string;
  form?: string;
};

const GENERIC_ERROR = "No se pudo restablecer la contraseña. Inténtalo de nuevo.";

function errorsFromCode(code: string): FieldErrors {
  switch (code) {
    case "RESET_TOKEN_INVALID":
      return { form: "Este enlace no es válido o ha caducado. Solicita uno nuevo." };
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

export function RestablecerContrasenaScreen({ token }: { token: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const savingRef = useRef(false);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmNewPasswordRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (errors.newPassword) {
      newPasswordRef.current?.focus();
    } else if (errors.confirmNewPassword) {
      confirmNewPasswordRef.current?.focus();
    } else if (errors.form) {
      formErrorRef.current?.focus();
    }
  }, [errors]);

  function updateField(field: "newPassword" | "confirmNewPassword", value: string) {
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
    if (!newPassword) validation.newPassword = "Introduce una contraseña nueva.";
    // El formulario lleva noValidate (ver más abajo), así que el `required`
    // de este campo no lo hace el navegador — sin esta comprobación se podía
    // guardar con la confirmación vacía.
    if (!confirmNewPassword) {
      validation.confirmNewPassword = "Confirma la contraseña nueva.";
    } else if (newPassword && newPassword !== confirmNewPassword) {
      validation.confirmNewPassword = "Las contraseñas no coinciden.";
    }
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setErrors({});

    try {
      // Con un restablecimiento correcto, resetPasswordAction hace
      // redirect() por dentro (lanza — no vuelve aquí). Solo llegamos a leer
      // `result` cuando falla.
      const result = await resetPasswordAction({ token, newPassword });
      if (result?.error) {
        setErrors(errorsFromCode(result.error));
        savingRef.current = false;
        setIsSaving(false);
      }
    } catch (error) {
      // redirect() de Next lanza internamente (digest NEXT_REDIRECT) — eso
      // debe seguir su curso, no tratarse como un fallo. Cualquier otro
      // rechazo (red caída, etc.) sí debe liberar el cerrojo y avisar.
      unstable_rethrow(error);
      setErrors({ form: GENERIC_ERROR });
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 px-4 py-10">
      <div>
        <h1 className="font-screen-title m-0 text-text">Restablecer contraseña</h1>
        <p className="font-body m-0 text-text-secondary">Elige una contraseña nueva para tu cuenta.</p>
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
          {isSaving ? "Guardando…" : "Restablecer contraseña"}
        </Button>
      </form>

      {errors.form && (
        <Button href="/recuperar-contrasena" variant="secondary" className="w-full">
          Pedir un enlace nuevo
        </Button>
      )}
    </div>
  );
}
