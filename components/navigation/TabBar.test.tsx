// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TabBar } from "./TabBar";

let currentPathname = "/estadisticas";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

afterEach(() => {
  cleanup();
});

describe("TabBar", () => {
  it("se muestra en una pestaña normal", () => {
    currentPathname = "/estadisticas";
    render(<TabBar />);
    expect(screen.queryByRole("navigation")).not.toBeNull();
  });

  it("se oculta en /clientes/nuevo (PRO-24)", () => {
    currentPathname = "/clientes/nuevo";
    render(<TabBar />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("se oculta en la ficha de cliente /clientes/[id] (PRO-24)", () => {
    currentPathname = "/clientes/abc123";
    render(<TabBar />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("se oculta en /clientes/[id]/venta (PRO-23)", () => {
    currentPathname = "/clientes/abc123/venta";
    render(<TabBar />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("se muestra en la lista de clientes /clientes (sí es un destino de pestaña)", () => {
    currentPathname = "/clientes";
    render(<TabBar />);
    expect(screen.queryByRole("navigation")).not.toBeNull();
  });
});
