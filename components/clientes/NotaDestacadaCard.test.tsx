// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Id } from "@/convex/_generated/dataModel";
import { NotaDestacadaCard } from "./NotaDestacadaCard";

const mutationMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mutationMock,
}));

const NOTE = { _id: "note1" as Id<"notes">, text: "Pidió que le llamáramos esta semana.", date: "2026-08-08", authorName: "Marta" };

beforeEach(() => {
  mutationMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("NotaDestacadaCard", () => {
  it("muestra el texto, autor y fecha", () => {
    render(<NotaDestacadaCard note={NOTE} />);
    expect(screen.getByText("Pidió que le llamáramos esta semana.")).toBeTruthy();
    expect(screen.getByText("Marta · 08/08/2026")).toBeTruthy();
  });

  it("quitar destacado llama a la mutation con el noteId", async () => {
    mutationMock.mockResolvedValue(null);
    render(<NotaDestacadaCard note={NOTE} />);

    fireEvent.click(screen.getByRole("button", { name: "Quitar destacado" }));
    await waitFor(() => expect(mutationMock).toHaveBeenCalledWith({ noteId: NOTE._id }));
  });

  it("un fallo al quitar destacado muestra un error inline y no bloquea el botón para siempre", async () => {
    mutationMock.mockRejectedValueOnce(new Error("network down"));
    render(<NotaDestacadaCard note={NOTE} />);

    const button = screen.getByRole("button", { name: "Quitar destacado" });
    fireEvent.click(button);
    expect(await screen.findByText("No se pudo quitar el destacado. Inténtalo de nuevo.")).toBeTruthy();
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));

    mutationMock.mockResolvedValueOnce(null);
    fireEvent.click(button);
    await waitFor(() => expect(mutationMock).toHaveBeenCalledTimes(2));
  });
});
