"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { requestPasswordResetAction } from "@/app/recuperar-contrasena/actions";

const GENERIC_ERROR = "No se pudo procesar la solicitud. Inténtalo de nuevo.";

export function RecuperarContrasenaScreen() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cerrojo síncrono contra doble envío, mismo criterio que LoginScreen.
  const savingRef = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (fieldError) {
      emailRef.current?.focus();
    } else if (formError) {
      formErrorRef.current?.focus();
    }
  }, [fieldError, formError]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;

    if (!email.trim()) {
      setFieldError("Introduce tu email.");
      setFormError(undefined);
      return;
    }

    savingRef.current = true;
    setIsSubmitting(true);
    setFormError(undefined);

    try {
      // requestPasswordResetAction siempre hace redirect() por dentro (lanza
      // — no vuelve aquí), exista o no una cuenta con ese email.
      await requestPasswordResetAction({ email: email.trim() });
    } catch (error) {
      // redirect() de Next lanza internamente (digest NEXT_REDIRECT) — eso
      // debe seguir su curso. Cualquier otro rechazo (red caída, etc.) sí
      // debe liberar el cerrojo y avisar.
      unstable_rethrow(error);
      setFormError(GENERIC_ERROR);
      savingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center font-caption uppercase tracking-wide text-text-tertiary">Loop CRM</p>

        <div className="mb-5">
          <h1 className="font-screen-title m-0 text-text">Recuperar contraseña</h1>
          <p className="font-body m-0 text-text-secondary">Te enviaremos un código de 6 dígitos para restablecerla.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {formError && (
            <p
              ref={formErrorRef}
              role="alert"
              tabIndex={-1}
              className="flex items-start gap-2.5 rounded-md border border-error-border bg-error-bg px-3.5 py-3 font-secondary text-error-text outline-none"
            >
              <Icon name="alert-circle" size={18} className="mt-0.5 shrink-0" />
              {formError}
            </p>
          )}

          <Input
            ref={emailRef}
            label="Email"
            required
            value={email}
            onChange={(value) => {
              setEmail(value);
              setFieldError(undefined);
            }}
            error={fieldError}
            type="email"
            placeholder="tú@ejemplo.com"
            autoComplete="email"
          />

          <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Enviando…" : "Enviar código"}
          </Button>
        </form>

        <Button href="/login" variant="ghost" className="mt-5 w-full">
          Volver a iniciar sesión
        </Button>
      </div>
    </div>
  );
}
