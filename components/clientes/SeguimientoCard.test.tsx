// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Id } from "@/convex/_generated/dataModel";
import { SeguimientoCard } from "./SeguimientoCard";

// api.x.y (anyApi) genera un objeto NUEVO en cada acceso a una propiedad —
// no sirve como clave para distinguir mutations por referencia. Cada test
// solo dispara una acción a la vez, así que un único mock compartido para
// las tres mutations (upsert/complete/discard) basta: se identifica cuál
// se llamó por la forma de sus argumentos, no por qué referencia de `api`
// se usó — mismo criterio que NuevoClienteScreen.test.tsx con una sola
// mutation.
const mutationMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mutationMock,
}));

const CLIENT_ID = "client1" as Id<"clients">;
const FOLLOW_UP_ID = "fu1" as Id<"followUps">;
const TODAY = "2026-08-08";

let confirmSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mutationMock.mockReset();
});

afterEach(() => {
  cleanup();
  confirmSpy?.mockRestore();
});

describe("SeguimientoCard — sin seguimiento activo", () => {
  it("muestra el EmptyState con 'Marcar seguimiento'", () => {
    render(<SeguimientoCard clientId={CLIENT_ID} followUp={null} today={TODAY} />);
    expect(screen.getByText("Sin seguimiento")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marcar seguimiento" })).toBeTruthy();
  });

  it("marcar con un chip: guarda con la fecha del atajo", async () => {
    mutationMock.mockResolvedValue(FOLLOW_UP_ID);
    render(<SeguimientoCard clientId={CLIENT_ID} followUp={null} today={TODAY} />);

    fireEvent.click(screen.getByRole("button", { name: "Marcar seguimiento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mañana" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mutationMock).toHaveBeenCalledWith({ clientId: CLIENT_ID, dueDate: "2026-08-09", actionType: "call" }),
    );
  });

  it("pulsar un chip no envía el formulario por sí solo (los chips son type=button)", async () => {
    render(<SeguimientoCard clientId={CLIENT_ID} followUp={null} today={TODAY} />);

    fireEvent.click(screen.getByRole("button", { name: "Marcar seguimiento" }));
    fireEvent.click(await screen.findByRole("button", { name: "En 3 días" }));

    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("marcar con la fecha libre y un tipo de acción distinto", async () => {
    mutationMock.mockResolvedValue(FOLLOW_UP_ID);
    render(<SeguimientoCard clientId={CLIENT_ID} followUp={null} today={TODAY} />);

    fireEvent.click(screen.getByRole("button", { name: "Marcar seguimiento" }));
    fireEvent.change(await screen.findByLabelText("Fecha"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Tipo de próxima acción"), { target: { value: "visit" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mutationMock).toHaveBeenCalledWith({ clientId: CLIENT_ID, dueDate: "2026-09-01", actionType: "visit" }),
    );
  });

  it("'Guardar' empieza deshabilitado hasta elegir una fecha", async () => {
    render(<SeguimientoCard clientId={CLIENT_ID} followUp={null} today={TODAY} />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar seguimiento" }));
    const guardar = await screen.findByRole("button", { name: "Guardar" });
    expect((guardar as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("SeguimientoCard — con seguimiento activo", () => {
  const followUp = { _id: FOLLOW_UP_ID, dueDate: TODAY, actionType: "call" as const };

  it("muestra el tipo de acción y la etiqueta de fecha", () => {
    render(<SeguimientoCard clientId={CLIENT_ID} followUp={followUp} today={TODAY} />);
    expect(screen.getByText("Llamar · Hoy")).toBeTruthy();
  });

  it("marca 'Atrasado' cuando la fecha ya pasó", () => {
    render(<SeguimientoCard clientId={CLIENT_ID} followUp={{ ...followUp, dueDate: "2026-08-01" }} today={TODAY} />);
    expect(screen.getByText("Llamar · Atrasado (01/08/2026)")).toBeTruthy();
  });

  it("completar llama a la mutation con el followUpId correcto", async () => {
    mutationMock.mockResolvedValue("note1");
    render(<SeguimientoCard clientId={CLIENT_ID} followUp={followUp} today={TODAY} />);

    fireEvent.click(screen.getByRole("button", { name: "Completar" }));
    await waitFor(() => expect(mutationMock).toHaveBeenCalledWith({ followUpId: FOLLOW_UP_ID }));
  });

  it("doble clic rápido en 'Completar' solo dispara una mutation", async () => {
    let resolveComplete!: (value: string) => void;
    mutationMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveComplete = resolve;
        }),
    );
    render(<SeguimientoCard clientId={CLIENT_ID} followUp={followUp} today={TODAY} />);

    const button = screen.getByRole("button", { name: "Completar" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mutationMock).toHaveBeenCalledTimes(1);
    resolveComplete("note1");
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    expect(mutationMock).toHaveBeenCalledTimes(1);
  });

  it("doble clic rápido en 'Descartar' solo dispara una mutation", async () => {
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    let resolveDiscard!: (value: null) => void;
    mutationMock.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolveDiscard = resolve;
        }),
    );
    render(<SeguimientoCard clientId={CLIENT_ID} followUp={followUp} today={TODAY} />);

    const button = screen.getByRole("button", { name: "Descartar" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mutationMock).toHaveBeenCalledTimes(1);
    resolveDiscard(null);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    expect(mutationMock).toHaveBeenCalledTimes(1);
  });

  it("descartar pide confirmación nativa antes de llamar a la mutation", async () => {
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mutationMock.mockResolvedValue(null);
    render(<SeguimientoCard clientId={CLIENT_ID} followUp={followUp} today={TODAY} />);

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(mutationMock).toHaveBeenCalledWith({ followUpId: FOLLOW_UP_ID }));
  });

  it("descartar cancelado en el confirm no llama a la mutation", () => {
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<SeguimientoCard clientId={CLIENT_ID} followUp={followUp} today={TODAY} />);

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("reprogramar abre el overlay con el tipo y la fecha actuales precargados, y el tipo es editable", async () => {
    mutationMock.mockResolvedValue(FOLLOW_UP_ID);
    render(
      <SeguimientoCard
        clientId={CLIENT_ID}
        followUp={{ ...followUp, dueDate: "2026-08-10", actionType: "visit" }}
        today={TODAY}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reprogramar" }));
    expect(await screen.findByText("Reprogramar seguimiento")).toBeTruthy();

    const dateInput = screen.getByLabelText("Fecha") as HTMLInputElement;
    expect(dateInput.value).toBe("2026-08-10");
    const select = screen.getByLabelText("Tipo de próxima acción") as HTMLSelectElement;
    expect(select.value).toBe("visit");

    fireEvent.change(select, { target: { value: "email" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mutationMock).toHaveBeenCalledWith({ clientId: CLIENT_ID, dueDate: "2026-08-10", actionType: "email" }),
    );
  });

  it("un fallo al completar muestra un error inline y no bloquea el botón para siempre", async () => {
    mutationMock.mockRejectedValueOnce(new Error("network down"));
    render(<SeguimientoCard clientId={CLIENT_ID} followUp={followUp} today={TODAY} />);

    fireEvent.click(screen.getByRole("button", { name: "Completar" }));
    expect(await screen.findByText("No se pudo completar el seguimiento. Inténtalo de nuevo.")).toBeTruthy();

    mutationMock.mockResolvedValueOnce("note1");
    fireEvent.click(screen.getByRole("button", { name: "Completar" }));
    await waitFor(() => expect(mutationMock).toHaveBeenCalledTimes(2));
  });
});
