// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel";
import { AnadirNotaOverlay } from "./AnadirNotaOverlay";

const mutationMock = vi.fn();

vi.mock("@/lib/convex/authedHooks", () => ({
  useAuthedMutation: () => mutationMock,
}));

const CLIENT_ID = "client1" as Id<"clients">;
const OLD_FEATURED_ID = "note-old" as Id<"notes">;
const NEW_FEATURED_ID = "note-new" as Id<"notes">;

beforeEach(() => {
  mutationMock.mockReset();
});

afterEach(() => {
  cleanup();
});

function fillText(value: string) {
  fireEvent.change(screen.getByLabelText(/^Interacción/), { target: { value } });
}

describe("AnadirNotaOverlay — nota normal", () => {
  it("guarda sin destacar, sin pedir confirmación", async () => {
    mutationMock.mockResolvedValue("note1");
    const onClose = vi.fn();
    render(<AnadirNotaOverlay clientId={CLIENT_ID} featured={null} onClose={onClose} />);

    fillText("Primer contacto por WhatsApp.");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mutationMock).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        text: "Primer contacto por WhatsApp.",
        channel: undefined,
        featured: false,
        expectedFeaturedNoteId: null,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("texto vacío muestra error de campo y no llama a la mutation", () => {
    render(<AnadirNotaOverlay clientId={CLIENT_ID} featured={null} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByText("Escribe el contenido de la interacción.")).toBeTruthy();
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("texto por encima de 4000 caracteres muestra error y no llama a la mutation", () => {
    render(<AnadirNotaOverlay clientId={CLIENT_ID} featured={null} onClose={vi.fn()} />);
    fillText("a".repeat(4001));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByText("El texto de la interacción es demasiado largo.")).toBeTruthy();
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("doble clic en Guardar solo dispara una mutation", async () => {
    let resolveCreate!: (value: string) => void;
    mutationMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    render(<AnadirNotaOverlay clientId={CLIENT_ID} featured={null} onClose={vi.fn()} />);

    fillText("Nota");
    const button = screen.getByRole("button", { name: "Guardar" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mutationMock).toHaveBeenCalledTimes(1);
    resolveCreate("note1");
  });

  it("CLIENT_NOT_FOUND muestra un mensaje específico (más plausible desde el selector de Hoy, PRO-60)", async () => {
    mutationMock.mockRejectedValueOnce(new ConvexError({ code: "CLIENT_NOT_FOUND", message: "El cliente no existe." }));
    render(<AnadirNotaOverlay clientId={CLIENT_ID} featured={null} onClose={vi.fn()} />);

    fillText("Nota");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Este cliente ya no existe.")).toBeTruthy();
  });

  it("fallo de red muestra error inline y permite reintentar", async () => {
    mutationMock.mockRejectedValueOnce(new Error("network down"));
    mutationMock.mockResolvedValueOnce("note1");
    const onClose = vi.fn();
    render(<AnadirNotaOverlay clientId={CLIENT_ID} featured={null} onClose={onClose} />);

    fillText("Nota");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("No se pudo guardar la interacción. Inténtalo de nuevo.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe("AnadirNotaOverlay — destacada", () => {
  it("marcar como destacada SIN otra previa no pide confirmación", async () => {
    mutationMock.mockResolvedValue("note1");
    render(<AnadirNotaOverlay clientId={CLIENT_ID} featured={null} onClose={vi.fn()} />);

    fillText("Nota importante");
    fireEvent.click(screen.getByRole("switch", { name: "Marcar como destacada" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mutationMock).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        text: "Nota importante",
        channel: undefined,
        featured: true,
        expectedFeaturedNoteId: null,
      }),
    );
  });

  it("marcar como destacada CON otra previa pide confirmación antes de llamar a la mutation", async () => {
    render(<AnadirNotaOverlay clientId={CLIENT_ID} featured={{ _id: OLD_FEATURED_ID }} onClose={vi.fn()} />);

    fillText("Nota nueva destacada");
    fireEvent.click(screen.getByRole("switch", { name: "Marcar como destacada" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText("Ya hay otra interacción destacada. Si continúas, esta la sustituirá."),
    ).toBeTruthy();
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("confirmar la sustitución llama a la mutation con expectedFeaturedNoteId", async () => {
    mutationMock.mockResolvedValue("note1");
    const onClose = vi.fn();
    render(<AnadirNotaOverlay clientId={CLIENT_ID} featured={{ _id: OLD_FEATURED_ID }} onClose={onClose} />);

    fillText("Nota nueva destacada");
    fireEvent.click(screen.getByRole("switch", { name: "Marcar como destacada" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sustituir" }));

    await waitFor(() =>
      expect(mutationMock).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        text: "Nota nueva destacada",
        channel: undefined,
        featured: true,
        expectedFeaturedNoteId: OLD_FEATURED_ID,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("congela el ID de la destacada al confirmar: un rerender OLD→NEW no cambia qué nota se sustituye", async () => {
    mutationMock.mockResolvedValue("note1");
    const onClose = vi.fn();
    const { rerender } = render(
      <AnadirNotaOverlay clientId={CLIENT_ID} featured={{ _id: OLD_FEATURED_ID }} onClose={onClose} />,
    );

    fillText("Nota nueva destacada");
    fireEvent.click(screen.getByRole("switch", { name: "Marcar como destacada" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByText("Ya hay otra interacción destacada. Si continúas, esta la sustituirá.");

    // La query reactiva de `featured` trae una nota destacada distinta
    // mientras el diálogo de confirmación sigue abierto (otra sesión la
    // cambió casi a la vez). La confirmación debe seguir actuando sobre el
    // ID que se mostró y se confirmó, no sobre el valor en vivo.
    rerender(<AnadirNotaOverlay clientId={CLIENT_ID} featured={{ _id: NEW_FEATURED_ID }} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Sustituir" }));

    await waitFor(() =>
      expect(mutationMock).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        text: "Nota nueva destacada",
        channel: undefined,
        featured: true,
        expectedFeaturedNoteId: OLD_FEATURED_ID,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("cancelar la confirmación vuelve al formulario conservando el texto ya escrito", async () => {
    render(<AnadirNotaOverlay clientId={CLIENT_ID} featured={{ _id: OLD_FEATURED_ID }} onClose={vi.fn()} />);

    fillText("No quiero perder esto");
    fireEvent.click(screen.getByRole("switch", { name: "Marcar como destacada" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByText("Ya hay otra interacción destacada. Si continúas, esta la sustituirá.");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByLabelText(/^Interacción/)).toHaveProperty("value", "No quiero perder esto");
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("FEATURED_NOTE_CONFLICT no reintenta sola: muestra error y vuelve al formulario", async () => {
    mutationMock.mockRejectedValueOnce(
      new ConvexError({ code: "FEATURED_NOTE_CONFLICT", message: "La nota destacada ha cambiado." }),
    );
    render(<AnadirNotaOverlay clientId={CLIENT_ID} featured={{ _id: OLD_FEATURED_ID }} onClose={vi.fn()} />);

    fillText("Intento con estado obsoleto");
    fireEvent.click(screen.getByRole("switch", { name: "Marcar como destacada" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sustituir" }));

    expect(
      await screen.findByText(
        "La interacción destacada ha cambiado desde que abriste este formulario. Vuelve a intentarlo.",
      ),
    ).toBeTruthy();
    // Vuelve al paso de formulario, no se queda en el de confirmación ni reintenta sola.
    expect(screen.getByLabelText(/^Interacción/)).toBeTruthy();
    expect(mutationMock).toHaveBeenCalledTimes(1);
  });

  it("elegir un canal lo incluye en la llamada a la mutation", async () => {
    mutationMock.mockResolvedValue("note1");
    render(<AnadirNotaOverlay clientId={CLIENT_ID} featured={null} onClose={vi.fn()} />);

    fillText("Le llamé para confirmar precio");
    fireEvent.change(screen.getByLabelText("Canal"), { target: { value: "call" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mutationMock).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        text: "Le llamé para confirmar precio",
        channel: "call",
        featured: false,
        expectedFeaturedNoteId: null,
      }),
    );
  });

  it('el selector de canal empieza en "Otro / sin canal"', () => {
    render(<AnadirNotaOverlay clientId={CLIENT_ID} featured={null} onClose={vi.fn()} />);

    expect(screen.getByLabelText("Canal")).toHaveProperty("value", "");
  });
});
