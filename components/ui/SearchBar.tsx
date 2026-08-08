import { Icon } from "./Icon";

const SEARCH_MAX_LENGTH = 100;

export function SearchBar({
  value,
  onChange,
  placeholder = "Buscar cliente",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex h-11 items-center gap-2.5 rounded-pill border border-border bg-surface-sunken px-4 focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)]">
      <Icon name="search" size={18} className="shrink-0 text-text-tertiary" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={SEARCH_MAX_LENGTH}
        aria-label={placeholder}
        className="font-body w-full bg-transparent text-text outline-none placeholder:text-text-tertiary"
      />
    </div>
  );
}
