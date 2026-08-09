// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { isFocusable } from "./Overlay";

// jsdom no calcula layout real: offsetParent es null por defecto para
// cualquier elemento, así que hay que sobrescribirlo a mano para simular
// "visible" en los casos donde no es precisamente eso lo que se prueba.
function mockVisible(el: HTMLElement) {
  Object.defineProperty(el, "offsetParent", { value: document.body, configurable: true });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isFocusable", () => {
  it("acepta un botón visible y habilitado", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    mockVisible(button);
    expect(isFocusable(button)).toBe(true);
  });

  it("rechaza offsetParent null (comportamiento por defecto de jsdom, sin mockear)", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    expect(isFocusable(button)).toBe(false);
  });

  it("rechaza un botón disabled", () => {
    const button = document.createElement("button");
    button.disabled = true;
    document.body.appendChild(button);
    mockVisible(button);
    expect(isFocusable(button)).toBe(false);
  });

  it('rechaza un botón con aria-disabled="true"', () => {
    const button = document.createElement("button");
    button.setAttribute("aria-disabled", "true");
    document.body.appendChild(button);
    mockVisible(button);
    expect(isFocusable(button)).toBe(false);
  });

  it("rechaza un botón oculto con el atributo hidden", () => {
    const button = document.createElement("button");
    button.hidden = true;
    document.body.appendChild(button);
    mockVisible(button);
    expect(isFocusable(button)).toBe(false);
  });

  it('rechaza un botón con aria-hidden="true"', () => {
    const button = document.createElement("button");
    button.setAttribute("aria-hidden", "true");
    document.body.appendChild(button);
    mockVisible(button);
    expect(isFocusable(button)).toBe(false);
  });

  it("rechaza un botón oculto por un ANCESTRO con hidden, no por sí mismo", () => {
    const container = document.createElement("div");
    container.hidden = true;
    const button = document.createElement("button");
    container.appendChild(button);
    document.body.appendChild(container);
    mockVisible(button);
    expect(isFocusable(button)).toBe(false);
  });

  it('rechaza un botón dentro de un contenedor con aria-hidden="true"', () => {
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    const button = document.createElement("button");
    container.appendChild(button);
    document.body.appendChild(container);
    mockVisible(button);
    expect(isFocusable(button)).toBe(false);
  });

  it("rechaza un botón dentro de un contenedor inert", () => {
    const container = document.createElement("div");
    container.setAttribute("inert", "");
    const button = document.createElement("button");
    container.appendChild(button);
    document.body.appendChild(container);
    mockVisible(button);
    expect(isFocusable(button)).toBe(false);
  });

  it("rechaza un botón con display:none", () => {
    const button = document.createElement("button");
    button.style.display = "none";
    document.body.appendChild(button);
    mockVisible(button);
    expect(isFocusable(button)).toBe(false);
  });

  it("rechaza un botón con visibility:hidden", () => {
    const button = document.createElement("button");
    button.style.visibility = "hidden";
    document.body.appendChild(button);
    mockVisible(button);
    expect(isFocusable(button)).toBe(false);
  });

  it("rechaza un elemento que no es un control focuseable (div sin tabindex)", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    mockVisible(div);
    expect(isFocusable(div)).toBe(false);
  });

  it('rechaza un div con tabindex="-1" (excluido explícitamente por el selector)', () => {
    const div = document.createElement("div");
    div.tabIndex = -1;
    document.body.appendChild(div);
    mockVisible(div);
    expect(isFocusable(div)).toBe(false);
  });

  it('acepta un div con tabindex="0"', () => {
    const div = document.createElement("div");
    div.tabIndex = 0;
    document.body.appendChild(div);
    mockVisible(div);
    expect(isFocusable(div)).toBe(true);
  });

  it("acepta un enlace con href", () => {
    const link = document.createElement("a");
    link.href = "#";
    document.body.appendChild(link);
    mockVisible(link);
    expect(isFocusable(link)).toBe(true);
  });
});
