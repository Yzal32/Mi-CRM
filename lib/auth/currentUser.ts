/**
 * Único punto de acceso al usuario de sesión. Hoy es un usuario de prueba
 * fijo (no hay login real todavía — ver plan, sección "Seguridad y modelo
 * de datos"): esto solo afecta a la presentación en Next.js, NO protege
 * ninguna función de Convex. Cuando exista login real (PRO-44), este es el
 * único archivo que debe cambiar en la UI para leer la sesión real — el
 * resto de componentes solo deben llamar a getCurrentUser(), nunca
 * hardcodear el usuario por su cuenta.
 */

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "employee";
};

const STUB_USER: CurrentUser = {
  id: "stub-marta",
  name: "Marta",
  email: "marta@example.com",
  role: "owner",
};

export function getCurrentUser(): CurrentUser {
  return STUB_USER;
}
