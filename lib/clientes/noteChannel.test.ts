import { describe, expect, it } from "vitest";
import { ACTION_TYPE_OPTIONS } from "@/lib/shared/actionType";
import { NOTE_CHANNEL_OPTIONS } from "./noteChannel";

describe("NOTE_CHANNEL_OPTIONS", () => {
  it('empieza con "Otro / sin canal" (value "") seguido de los 4 canales de ActionType', () => {
    expect(NOTE_CHANNEL_OPTIONS).toHaveLength(5);
    expect(NOTE_CHANNEL_OPTIONS[0]).toEqual({ value: "", label: "Otro / sin canal" });
    expect(NOTE_CHANNEL_OPTIONS.slice(1)).toEqual(ACTION_TYPE_OPTIONS);
  });
});
