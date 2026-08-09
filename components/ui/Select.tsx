import { forwardRef, useId } from "react";
import { clsx } from "clsx";

type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  // Oculta visualmente la etiqueta (queda accesible para lectores de
  // pantalla vía sr-only) — para selects compactos junto a un Badge, p. ej.
  // el cambio de estado en la cabecera de la ficha de cliente.
  hideLabel?: boolean;
  disabled?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, value, onChange, options, hideLabel, disabled },
  ref,
) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={clsx("font-caption text-text-secondary", hideLabel && "sr-only")}>
        {label}
      </label>
      <select
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={clsx(
          "h-11 rounded-md border border-border bg-surface px-4 font-body text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
});
