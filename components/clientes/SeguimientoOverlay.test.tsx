// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel";
import { SeguimientoOverlay } from "./SeguimientoOverlay";

const mutationMock = vi.fn();
vi.mock("@/lib/convex/authedHooks", () => ({
  useAuthedMutation: () => mutationMock,
}));

const CLIENT_ID = "client1" as Id<"clients">;
const TODAY = "2026-08-10";

beforeEach(() => {
  mutationMock.mockReset();
});

afterEach(() => {
  cleanup();
});

// Solo cubre el comportamiento nuevo (PRO-15/PRO-16: fecha mínima y mensaje
// de fecha pasada) — no hay más tests de este componente todavía.
describe("SeguimientoOverlay — fecha mínima y error de fecha pasada", () => {
  it("el input de fecha no admite valores anteriores a hoy (atributo min)", () => {
    render(<SeguimientoOverlay clientId={CLIENT_ID} followUp={null} today={TODAY} onClose={vi.fn()} />);

    expect(screen.getByLabelText("Fecha")).toHaveProperty("min", TODAY);
  });

  it("si la mutation rechaza con DUE_DATE_IN_PAST, muestra el mensaje específico", async () => {
    mutationMock.mockRejectedValue(new ConvexError({ code: "DUE_DATE_IN_PAST", message: "La fecha ya ha pasado." }));
    render(<SeguimientoOverlay clientId={CLIENT_ID} followUp={null} today={TODAY} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: TODAY } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(screen.getByText("No puedes elegir una fecha pasada.")).toBeTruthy();
    });
  });
});
