// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { api } from "@/convex/_generated/api";
import { FichaClienteScreen } from "./FichaClienteScreen";

// api.x.y (anyApi) genera un objeto NUEVO en cada acceso — no sirve como
// clave de Map por identidad. getFunctionName(ref) da un string estable
// ("clients:getById") independientemente de cuántas veces se acceda a la
// misma ruta, así que se usa como clave real.
const queryResults = new Map<string, unknown>();
const mutationMock = vi.fn();
const backMock = vi.fn();

const useQueryMock = vi.fn((ref: unknown, args: unknown) => {
  if (args === "skip") return undefined;
  return queryResults.get(getFunctionName(ref as never));
});

vi.mock("convex/react", () => ({
  useQuery: (...callArgs: [unknown, unknown]) => useQueryMock(...callArgs),
  useMutation: () => mutationMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: backMock, push: vi.fn(), replace: vi.fn() }),
}));

// useBusinessToday() calcula la fecha real del sistema — se fija para que
// las etiquetas Hoy/Atrasado sean deterministas en el test.
vi.mock("@/lib/hoy/useBusinessToday", () => ({
  useBusinessToday: () => "2026-08-08",
}));

function setQuery(ref: unknown, value: unknown) {
  queryResults.set(getFunctionName(ref as never), value);
}

const CLIENT_ID = "client1";

const READY_CLIENT = {
  _id: CLIENT_ID,
  name: "Carlos Ruiz",
  phone: "622334556",
  email: "carlos@example.com",
  originChannel: "web",
  status: "contacted",
};

const EMPTY_NOTES = { featured: null, items: [], truncated: false };
const EMPTY_SALES = { items: [], truncated: false };

function setReadyQueries(overrides: { client?: unknown; notes?: unknown; sales?: unknown; followUp?: unknown } = {}) {
  setQuery(api.clients.getById, overrides.client ?? READY_CLIENT);
  setQuery(api.notes.listByClient, overrides.notes ?? EMPTY_NOTES);
  setQuery(api.sales.listByClient, overrides.sales ?? EMPTY_SALES);
  setQuery(api.followUps.getByClient, overrides.followUp ?? null);
}

beforeEach(() => {
  queryResults.clear();
  mutationMock.mockReset();
  useQueryMock.mockClear();
  backMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("FichaClienteScreen — estados de carga", () => {
  it("muestra el Skeleton mientras el cliente está cargando", () => {
    // clients.getById no tiene entrada en queryResults => useQuery devuelve undefined (loading)
    render(<FichaClienteScreen clientId={CLIENT_ID} />);
    expect(screen.getByRole("status", { name: "Cargando" })).toBeTruthy();
  });

  it('cliente inexistente (o ID malformado) muestra "Cliente no encontrado"', () => {
    setQuery(api.clients.getById, null);
    render(<FichaClienteScreen clientId="id-invalido" />);
    expect(screen.getByText("Cliente no encontrado")).toBeTruthy();
  });

  it('las 3 queries dependientes se llaman con "skip" mientras el cliente no está listo', () => {
    render(<FichaClienteScreen clientId={CLIENT_ID} />);

    const calledWithSkip = (ref: unknown) =>
      useQueryMock.mock.calls.some(
        ([calledRef, calledArgs]) => getFunctionName(calledRef as never) === getFunctionName(ref as never) && calledArgs === "skip",
      );

    expect(calledWithSkip(api.notes.listByClient)).toBe(true);
    expect(calledWithSkip(api.sales.listByClient)).toBe(true);
    expect(calledWithSkip(api.followUps.getByClient)).toBe(true);
  });

  it("sigue mostrando el Skeleton si el cliente ya resolvió pero notes/sales/followUp aún no (un único estado de carga derivado)", () => {
    setQuery(api.clients.getById, READY_CLIENT);
    // notes/sales/followUp sin entrada todavía => undefined (en vuelo)
    render(<FichaClienteScreen clientId={CLIENT_ID} />);
    expect(screen.getByRole("status", { name: "Cargando" })).toBeTruthy();
    expect(screen.queryByText("Sin notas")).toBeNull();
  });
});

describe("FichaClienteScreen — camino principal completo", () => {
  it("renderiza cabecera, seguimiento vacío, notas vacías e historial vacío cuando todo resuelve", () => {
    setReadyQueries();
    render(<FichaClienteScreen clientId={CLIENT_ID} />);

    expect(screen.getByRole("heading", { name: "Carlos Ruiz", level: 1 })).toBeTruthy();
    expect(screen.getByText("Sin seguimiento")).toBeTruthy();
    expect(screen.getByText("Sin notas")).toBeTruthy();
    expect(screen.getByText("Sin ventas")).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Cargando" })).toBeNull();
  });

  it("muestra la nota destacada, las notas normales y el historial de compras cuando hay datos", () => {
    setReadyQueries({
      notes: {
        featured: { _id: "note-f", text: "Interesado en el pack premium.", date: "2026-08-01", authorName: "Marta" },
        items: [{ _id: "note-1", text: "Primer contacto.", date: "2026-07-20", authorName: "Marta" }],
        truncated: false,
      },
      sales: { items: [{ _id: "sale-1", description: "Pack básico", amountCents: 15000, date: "2026-07-25" }], truncated: false },
      followUp: { _id: "fu-1", dueDate: "2026-08-08", actionType: "call" },
    });
    render(<FichaClienteScreen clientId={CLIENT_ID} />);

    expect(screen.getByText("Interesado en el pack premium.")).toBeTruthy();
    expect(screen.getByText("Primer contacto.")).toBeTruthy();
    expect(screen.getByText("Pack básico")).toBeTruthy();
    expect(screen.getByText("Llamar · Hoy")).toBeTruthy();
  });

  it("botón Atrás de escritorio llama a router.back()", () => {
    setReadyQueries();
    render(<FichaClienteScreen clientId={CLIENT_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(backMock).toHaveBeenCalledTimes(1);
  });
});

describe("FichaClienteScreen — cambio de estado", () => {
  it("un rechazo de la mutation revierte el valor mostrado y muestra error", async () => {
    setReadyQueries();
    mutationMock.mockRejectedValueOnce(new Error("network down"));
    render(<FichaClienteScreen clientId={CLIENT_ID} />);

    const select = screen.getByLabelText("Cambiar estado") as HTMLSelectElement;
    expect(select.value).toBe("contacted");

    fireEvent.change(select, { target: { value: "won" } });
    expect(await screen.findByText("No se pudo cambiar el estado. Inténtalo de nuevo.")).toBeTruthy();
    await waitFor(() => expect(select.value).toBe("contacted"));
  });

  it(
    "tras resolver, el cerrojo se libera y el select cae al valor autoritativo aunque la siguiente " +
      "actualización reactiva traiga un valor DISTINTO del pedido (no se queda atascado)",
    async () => {
      setReadyQueries();
      mutationMock.mockResolvedValueOnce(null);
      const { rerender } = render(<FichaClienteScreen clientId={CLIENT_ID} />);

      const select = () => screen.getByLabelText("Cambiar estado") as HTMLSelectElement;
      fireEvent.change(select(), { target: { value: "won" } });

      await waitFor(() => expect(mutationMock).toHaveBeenCalledWith({ clientId: CLIENT_ID, status: "won" }));

      // La query reactiva "salta" directamente a un valor distinto del
      // pedido (otra sesión cambió el estado a "lost" casi a la vez).
      setQuery(api.clients.getById, { ...READY_CLIENT, status: "lost" });
      rerender(<FichaClienteScreen clientId={CLIENT_ID} />);

      await waitFor(() => expect(select().value).toBe("lost"));
      // Nunca se queda mostrando "won" (el valor pedido, no el real).
      expect(select().value).not.toBe("won");
    },
  );

  it("el select se deshabilita mientras la mutation está en vuelo", async () => {
    setReadyQueries();
    let resolveUpdate!: () => void;
    mutationMock.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolveUpdate = () => resolve(null);
        }),
    );
    render(<FichaClienteScreen clientId={CLIENT_ID} />);

    const select = screen.getByLabelText("Cambiar estado") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "won" } });

    await waitFor(() => expect(select.disabled).toBe(true));
    resolveUpdate();
    await waitFor(() => expect(select.disabled).toBe(false));
  });
});
