import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import { clsx } from "clsx";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "id">;

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, value, onChange, error, required, ...rest },
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
      <input
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={clsx(
          "h-11 rounded-md border bg-surface px-4 font-body text-text outline-none placeholder:text-text-tertiary focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
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
