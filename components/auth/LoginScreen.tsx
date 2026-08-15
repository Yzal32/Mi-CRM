"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { loginAction } from "@/app/login/actions";

const GENERIC_ERROR = "No se pudo iniciar sesión. Inténtalo de nuevo.";

function messageFromErrorCode(code: string | undefined): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "Email o contraseña incorrectos.";
    case "ACCOUNT_INACTIVE":
      return "Esta cuenta ya no tiene acceso.";
    case "ACCOUNT_NOT_PROVISIONED":
      return "Esta cuenta de Google no está autorizada en este CRM.";
    default:
      return GENERIC_ERROR;
  }
}

export function LoginScreen({
  initialErrorCode,
  showPasswordResetToast = false,
}: { initialErrorCode?: string; showPasswordResetToast?: boolean } = {}) {
  const router = useRouter();
  const [toastVisible, setToastVisible] = useState(showPasswordResetToast);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  // initialErrorCode llega por query param (?error=...) tras el redirect de
  // vuelta de /api/auth/google/callback (PRO-63) — a diferencia del login
  // por contraseña, ahí no hay una llamada a función que devuelva el error
  // directamente, es una navegación de página completa.
  const [formError, setFormError] = useState<string | undefined>(
    initialErrorCode ? messageFromErrorCode(initialErrorCode) : undefined,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cerrojo síncrono contra doble envío, mismo criterio que NuevoClienteScreen.
  const savingRef = useRef(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (fieldErrors.email) {
      emailRef.current?.focus();
    } else if (fieldErrors.password) {
      passwordRef.current?.focus();
    } else if (formError) {
      formErrorRef.current?.focus();
    }
  }, [fieldErrors, formError]);

  useEffect(() => {
    if (!showPasswordResetToast) return;
    // Limpia el query param para que un refresco no repita el toast — solo al montar.
    router.replace("/login", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una sola vez al montar
  }, []);

  function updateField(field: "email" | "password", value: string) {
    if (field === "email") setEmail(value);
    if (field === "password") setPassword(value);
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;

    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = "Introduce tu email.";
    if (!password) nextErrors.password = "Introduce tu contraseña.";
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setFormError(undefined);
      return;
    }

    savingRef.current = true;
    setIsSubmitting(true);
    setFormError(undefined);

    try {
      // Con credenciales correctas, loginAction hace redirect() por dentro
      // (lanza — no vuelve aquí). Solo llegamos a leer `result` cuando falla.
      const result = await loginAction({ email: email.trim(), password });
      if (result?.error) {
        setFormError(messageFromErrorCode(result.error));
        savingRef.current = false;
        setIsSubmitting(false);
      }
    } catch (error) {
      // redirect() de Next lanza internamente (digest NEXT_REDIRECT) — eso
      // debe seguir su curso, no tratarse como un fallo. Cualquier otro
      // rechazo (red caída, etc.) sí debe liberar el cerrojo y avisar.
      unstable_rethrow(error);
      setFormError(GENERIC_ERROR);
      savingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {toastVisible && (
          <Toast message="Contraseña actualizada. Inicia sesión con tu contraseña nueva." onDismiss={() => setToastVisible(false)} />
        )}

        <p className="mb-8 text-center font-caption uppercase tracking-wide text-text-tertiary">Loop CRM</p>

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
            onChange={(value) => updateField("email", value)}
            error={fieldErrors.email}
            type="email"
            placeholder="tú@ejemplo.com"
            autoComplete="email"
          />

          <Input
            ref={passwordRef}
            label="Contraseña"
            required
            value={password}
            onChange={(value) => updateField("password", value)}
            error={fieldErrors.password}
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
          />

          <Button href="/recuperar-contrasena" variant="ghost" size="sm" className="-mt-3 self-end">
            ¿Olvidaste tu contraseña?
          </Button>

          <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-text-tertiary">
          <div className="h-px flex-1 bg-border" />
          <span className="font-caption">o</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* prefetch={false}: /api/auth/google/start tiene efecto lateral
            real (fija una cookie de estado y redirige a Google) — sin esto,
            Next lo dispararía en segundo plano solo por estar en viewport. */}
        <Button href="/api/auth/google/start" variant="secondary" className="w-full" prefetch={false}>
          Continuar con Google
        </Button>
      </div>
    </div>
  );
}
