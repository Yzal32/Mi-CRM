// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ClientActionFlow } from "@/lib/hoy/useClientActionFlow";
import { ClientActionOverlays } from "./ClientActionOverlays";

const useQueryMock = vi.fn();
vi.mock("@/lib/convex/authedHooks", () => ({
  useAuthedQuery: (...args: unknown[]) => useQueryMock(...args),
}));

// Se aíslan el selector y el overlay de nota, ambos con su propia
// cobertura dedicada — aquí solo interesa a cuál de los dos (o ninguno) se
// enruta, y con qué props exactas.
vi.mock("@/components/clientes/SeleccionarClienteOverlay", () => ({
  SeleccionarClienteOverlay: ({ title }: { title: string }) => <div data-testid="selector">{title}</div>,
}));
vi.mock("@/components/clientes/AnadirNotaOverlay", () => ({
  AnadirNotaOverlay: ({ featured }: { featured: { _id: string } | null }) => (
    <div data-testid="anadir-nota">{featured ? `featured:${featured._id}` : "featured:null"}</div>
  ),
}));

const CLIENT = { clientId: "client1" as never, name: "Carlos Ruiz" };

function makeFlow(state: ClientActionFlow["state"]): ClientActionFlow {
  return {
    state,
    start: vi.fn(),
    cancelPicking: vi.fn(),
    selectClient: vi.fn(),
    closeNota: vi.fn(),
    reset: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  useQueryMock.mockReset();
});

describe("ClientActionOverlays — enrutado por flow.state", () => {
  it("idle no renderiza nada", () => {
    useQueryMock.mockReturnValue(undefined);
    const { container } = render(<ClientActionOverlays flow={makeFlow({ step: "idle" })} today="2026-08-13" />);
    expect(container.firstChild).toBeNull();
  });

  it('pickingClient con intent "venta" muestra el selector con título "Registrar venta"', () => {
    useQueryMock.mockReturnValue(undefined);
    render(<ClientActionOverlays flow={makeFlow({ step: "pickingClient", intent: "venta" })} today="2026-08-13" />);
    expect(screen.getByTestId("selector").textContent).toBe("Registrar venta");
  });

  it('pickingClient con intent "nota" muestra el selector con título "Anotar interacción"', () => {
    useQueryMock.mockReturnValue(undefined);
    render(<ClientActionOverlays flow={makeFlow({ step: "pickingClient", intent: "nota" })} today="2026-08-13" />);
    expect(screen.getByTestId("selector").textContent).toBe("Anotar interacción");
  });

  it("notaClient con notes.listByClient sin resolver todavía muestra un overlay de carga", () => {
    useQueryMock.mockReturnValue(undefined);
    render(<ClientActionOverlays flow={makeFlow({ step: "notaClient", client: CLIENT })} today="2026-08-13" />);
    expect(screen.getByRole("heading", { name: "Anotar interacción" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Cargando" })).toBeTruthy();
    expect(screen.queryByTestId("anadir-nota")).toBeNull();
  });

  it("notaClient con nota destacada pasa featured a AnadirNotaOverlay", () => {
    useQueryMock.mockReturnValue({ featured: { _id: "note1" }, items: [], truncated: false });
    render(<ClientActionOverlays flow={makeFlow({ step: "notaClient", client: CLIENT })} today="2026-08-13" />);
    expect(screen.getByTestId("anadir-nota").textContent).toBe("featured:note1");
  });

  it("notaClient sin nota destacada pasa featured: null a AnadirNotaOverlay", () => {
    useQueryMock.mockReturnValue({ featured: null, items: [], truncated: false });
    render(<ClientActionOverlays flow={makeFlow({ step: "notaClient", client: CLIENT })} today="2026-08-13" />);
    expect(screen.getByTestId("anadir-nota").textContent).toBe("featured:null");
  });

  it('notes.listByClient se llama con "skip" fuera de notaClient', () => {
    useQueryMock.mockReturnValue(undefined);
    render(<ClientActionOverlays flow={makeFlow({ step: "idle" })} today="2026-08-13" />);
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), "skip");
  });
});
