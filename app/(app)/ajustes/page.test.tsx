// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { getCurrentUser } from "@/lib/auth/currentUser";
import AjustesPage from "./page";

vi.mock("@/lib/auth/currentUser", () => ({ getCurrentUser: vi.fn() }));

afterEach(() => {
  cleanup();
});

describe("AjustesPage", () => {
  it("con rol owner, muestra el botón 'Gestión de empleados' hacia /empleados", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user1",
      name: "Marta Gómez",
      email: "marta@ejemplo.com",
      role: "owner",
    });

    render(await AjustesPage());

    const link = screen.getByRole("link", { name: "Gestión de empleados" });
    expect(link.getAttribute("href")).toBe("/empleados");
  });

  it("con rol employee, NO muestra el botón 'Gestión de empleados'", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user2",
      name: "Carlos Ruiz",
      email: "carlos@ejemplo.com",
      role: "employee",
    });

    render(await AjustesPage());

    expect(screen.queryByRole("link", { name: "Gestión de empleados" })).toBeNull();
  });
});
