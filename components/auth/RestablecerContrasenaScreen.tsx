"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { resetPasswordAction } from "@/app/restablecer-contrasena/actions";

type FieldErrors = {
  email?: string;
  code?: string;
  newPassword?: string;
  confirmNewPassword?: string;
  form?: string;
};

const CODE_PATTERN = /^\d{6}$/;
const GENERIC_ERROR = "No se pudo restablecer la contraseña. Inténtalo de nuevo.";

function errorsFromCode(code: string): FieldErrors {
  switch (code) {
    case "RESET_CODE_INVALID":
      return { form: "Código incorrecto o caducado. Solicita uno nuevo." };
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

export function RestablecerContrasenaScreen({ initialEmail }: { initialEmail?: string } = {}) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const savingRef = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmNewPasswordRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (errors.email) {
      emailRef.current?.focus();
    } else if (errors.code) {
      codeRef.current?.focus();
    } else if (errors.newPassword) {
      newPasswordRef.current?.focus();
    } else if (errors.confirmNewPassword) {
      confirmNewPasswordRef.current?.focus();
    } else if (errors.form) {
      formErrorRef.current?.focus();
    }
  }, [errors]);

  function updateField(field: "email" | "code" | "newPassword" | "confirmNewPassword", value: string) {
    if (field === "email") setEmail(value);
    if (field === "code") setCode(value);
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
    if (!email.trim()) validation.email = "Introduce tu email.";
    if (!code.trim()) {
      validation.code = "Introduce el código que te hemos enviado.";
    } else if (!CODE_PATTERN.test(code.trim())) {
      validation.code = "El código debe tener 6 dígitos.";
    }
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
      const result = await resetPasswordAction({ email: email.trim(), code: code.trim(), newPassword });
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
        <p className="font-body m-0 text-text-secondary">
          Si existe una cuenta con ese email, te hemos enviado un código de 6 dígitos. Introdúcelo aquí junto con tu contraseña nueva.
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
          ref={emailRef}
          label="Email"
          required
          value={email}
          onChange={(value) => updateField("email", value)}
          error={errors.email}
          type="email"
          placeholder="tú@ejemplo.com"
          autoComplete="email"
        />

        <Input
          ref={codeRef}
          label="Código"
          required
          value={code}
          onChange={(value) => updateField("code", value)}
          error={errors.code}
          type="text"
          inputMode="numeric"
          placeholder="123456"
          autoComplete="one-time-code"
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
          {isSaving ? "Guardando…" : "Restablecer contraseña"}
        </Button>
      </form>

      {errors.form && (
        <Button href="/recuperar-contrasena" variant="secondary" className="w-full">
          Pedir un código nuevo
        </Button>
      )}
    </div>
  );
}
