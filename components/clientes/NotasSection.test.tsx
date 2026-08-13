// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Id } from "@/convex/_generated/dataModel";
import { NotasSection } from "./NotasSection";

const mutationMock = vi.fn();

vi.mock("@/lib/convex/authedHooks", () => ({
  useAuthedMutation: () => mutationMock,
}));

afterEach(() => {
  cleanup();
});

const CLIENT_ID = "client1" as Id<"clients">;

describe("NotasSection", () => {
  it("cabecera y botón dicen Interacciones / Anotar interacción", () => {
    render(<NotasSection clientId={CLIENT_ID} featured={null} items={[]} truncated={false} />);
    expect(screen.getByRole("heading", { name: "Interacciones" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Anotar interacción" })).toBeTruthy();
  });

  it("sin interacciones muestra el EmptyState", () => {
    render(<NotasSection clientId={CLIENT_ID} featured={null} items={[]} truncated={false} />);
    expect(screen.getByText("Sin interacciones")).toBeTruthy();
    expect(screen.getByText("Todavía no se ha registrado ninguna interacción con este cliente.")).toBeTruthy();
  });

  it("con una interacción sin canal, muestra autor y fecha sin icono ni etiqueta", () => {
    render(
      <NotasSection
        clientId={CLIENT_ID}
        featured={null}
        items={[{ _id: "n1" as Id<"notes">, text: "Primer contacto", date: "2026-08-08", authorName: "Ana" }]}
        truncated={false}
      />,
    );
    expect(screen.getByText("Primer contacto")).toBeTruthy();
    expect(screen.getByText("Ana · 08/08/2026")).toBeTruthy();
  });

  it("con canal, muestra su etiqueta antes del autor", () => {
    render(
      <NotasSection
        clientId={CLIENT_ID}
        featured={null}
        items={[
          { _id: "n1" as Id<"notes">, text: "Llamada", date: "2026-08-08", authorName: "Ana", channel: "call" },
        ]}
        truncated={false}
      />,
    );
    expect(screen.getByText("Llamar · Ana · 08/08/2026")).toBeTruthy();
  });

  it("truncated muestra el aviso de las 500 más recientes", () => {
    render(<NotasSection clientId={CLIENT_ID} featured={null} items={[]} truncated={true} />);
    expect(screen.getByText("Mostrando las 500 interacciones más recientes.")).toBeTruthy();
  });

  it('pulsar "Anotar interacción" abre el formulario', () => {
    render(<NotasSection clientId={CLIENT_ID} featured={null} items={[]} truncated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Anotar interacción" }));
    expect(screen.getByLabelText("Canal")).toBeTruthy();
    expect(screen.getByLabelText(/^Interacción/)).toBeTruthy();
  });
});
