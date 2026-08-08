import { forwardRef, useId } from "react";

type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
};

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, value, onChange, options },
  ref,
) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-caption text-text-secondary">
        {label}
      </label>
      <select
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-md border border-border bg-surface px-4 font-body text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
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
