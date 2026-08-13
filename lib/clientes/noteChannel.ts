import type { ActionType } from "@/lib/shared/actionType";
import { ACTION_TYPE_OPTIONS } from "@/lib/shared/actionType";

// "" es el sentinel de "Otro / sin canal" en el <select> del formulario de
// interacción — se traduce a `channel: undefined` justo antes de llamar a
// notes.create (ver AnadirNotaOverlay). No hay un valor "other" persistido
// en base de datos: una interacción sin canal elegido y una anterior a este
// campo quedan indistinguibles a propósito.
export type NoteChannelFormValue = ActionType | "";

export const NOTE_CHANNEL_OPTIONS: { value: NoteChannelFormValue; label: string }[] = [
  { value: "", label: "Otro / sin canal" },
  ...ACTION_TYPE_OPTIONS,
];
