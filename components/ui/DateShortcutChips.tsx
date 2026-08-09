import { clsx } from "clsx";
import { addDays } from "@/lib/shared/businessDay";

type Shortcut = { label: string; deltaDays: number };

const SHORTCUTS: Shortcut[] = [
  { label: "Mañana", deltaDays: 1 },
  { label: "En 3 días", deltaDays: 3 },
  { label: "En 1 semana", deltaDays: 7 },
];

type Props = {
  today: string;
  dueDate: string;
  onSelect: (dueDate: string) => void;
};

/**
 * `dueDate` es la única fuente de verdad, no hay un estado de "chip
 * seleccionado" aparte: cada chip solo llama a onSelect con la fecha que
 * representa, y deriva su aspecto "activo" comparando esa fecha con
 * `dueDate` en cada render — si el usuario teclea una fecha que no
 * coincide con ningún atajo, todos quedan inactivos automáticamente.
 *
 * `type="button"` explícito en cada chip: dentro de un <form>, un <button>
 * sin tipo es type="submit" por defecto — sin esto, pulsar un chip
 * enviaría el formulario aunque el botón "Guardar" esté deshabilitado.
 */
export function DateShortcutChips({ today, dueDate, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {SHORTCUTS.map((shortcut) => {
        const shortcutDate = addDays(today, shortcut.deltaDays);
        const active = dueDate === shortcutDate;
        return (
          <button
            key={shortcut.label}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(shortcutDate)}
            className={clsx(
              "rounded-full border px-3.5 py-1.5 font-caption transition-colors",
              active ? "border-primary bg-primary-soft text-primary-soft-text" : "border-border bg-surface text-text-secondary",
            )}
          >
            {shortcut.label}
          </button>
        );
      })}
    </div>
  );
}
