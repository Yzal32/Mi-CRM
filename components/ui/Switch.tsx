import { useId } from "react";
import { clsx } from "clsx";

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

// <button role="switch" aria-checked> real (no un <div> con onClick): el
// teclado (Space/Enter) funciona gratis por ser un <button> nativo.
export function Switch({ label, checked, onChange }: Props) {
  const id = useId();

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          "inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
          checked ? "bg-primary" : "bg-border",
        )}
      >
        <span
          aria-hidden="true"
          className={clsx(
            "h-5 w-5 rounded-full bg-surface shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
      {/* htmlFor no activa un <button> automáticamente (solo controles de
          formulario nativos) — el onClick aquí replica ese comportamiento
          para poder tocar toda la fila, no solo el control. */}
      <label htmlFor={id} className="cursor-pointer font-caption text-text-secondary" onClick={() => onChange(!checked)}>
        {label}
      </label>
    </div>
  );
}
