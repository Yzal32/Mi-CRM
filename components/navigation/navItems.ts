import type { IconName } from "@/components/ui/Icon";

export type NavItem = {
  value: "clients" | "today" | "stats" | "settings";
  label: string;
  icon: IconName;
  href: string;
};

export const navItems: NavItem[] = [
  { value: "clients", label: "Clientes", icon: "users", href: "/clientes" },
  { value: "today", label: "Hoy", icon: "calendar-check", href: "/" },
  { value: "stats", label: "Estadísticas", icon: "bar-chart-2", href: "/estadisticas" },
  { value: "settings", label: "Ajustes", icon: "settings", href: "/ajustes" },
];

/**
 * "/" compara exacto (es la raíz); el resto compara por prefijo, para que
 * p. ej. /clientes/nuevo y /clientes/[clientId] sigan resaltando "Clientes".
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Si `pathname` es la ruta de una ficha de cliente (/clientes/<id>, nunca
 * /clientes/nuevo ni /clientes en sí) devuelve el id; si no, null.
 * Compartido entre TabBar (para ocultarse, PRO-24) y MobileTopBar (para
 * cargar el nombre del cliente en el título) — misma regla en un solo sitio.
 */
export function extractFichaClientId(pathname: string): string | null {
  const match = /^\/clientes\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  const [, id] = match;
  return id === "nuevo" ? null : id;
}

/**
 * Si `pathname` es la ruta de "Registrar venta" (/clientes/<id>/venta)
 * devuelve el id del cliente; si no, null. Pantalla de formulario/detalle
 * (PRO-23, igual que /clientes/nuevo y la ficha) — TabBar se oculta y
 * MobileTopBar muestra su propio título fijo en vez del de la pestaña activa.
 */
export function extractVentaClientId(pathname: string): string | null {
  const match = /^\/clientes\/([^/]+)\/venta$/.exec(pathname);
  return match ? match[1] : null;
}
