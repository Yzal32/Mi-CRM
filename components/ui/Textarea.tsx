import { forwardRef, useId } from "react";
import type { TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "className" | "id">;

// Mismo contrato visual que Input.tsx, pero pasando `required` al elemento
// nativo (accesibilidad: `noValidate` en el <form> solo desactiva el popup
// automático de validación al enviar, no sustituye la semántica de
// `required` para lectores de pantalla — Input.tsx tenía este mismo
// defecto, corregido a la vez que se creó este componente).
export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { label, value, onChange, error, required, rows = 4, ...rest },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-caption text-text-secondary">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={clsx(
          "resize-none rounded-md border bg-surface px-4 py-2.5 font-body text-text outline-none placeholder:text-text-tertiary focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
          error ? "border-error-border" : "border-border",
        )}
        {...rest}
      />
      {error && (
        <p id={errorId} className="font-caption text-error-text">
          {error}
        </p>
      )}
    </div>
  );
});
