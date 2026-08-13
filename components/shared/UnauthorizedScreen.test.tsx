// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnauthorizedScreen } from "./UnauthorizedScreen";

describe("UnauthorizedScreen", () => {
  it("muestra el título, el mensaje y un enlace para volver a Hoy", () => {
    render(<UnauthorizedScreen />);

    expect(screen.getByText("No autorizado")).toBeTruthy();
    expect(screen.getByText("Esta sección solo está disponible para la cuenta de la Dueña.")).toBeTruthy();

    const link = screen.getByRole("link", { name: "Volver a Hoy" });
    expect(link.getAttribute("href")).toBe("/");
  });
});
