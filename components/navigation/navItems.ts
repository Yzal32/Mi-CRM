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
