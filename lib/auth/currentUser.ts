import { getSessionUser } from "@/lib/auth/session";

/**
 * Único punto de acceso al usuario de sesión para la UI. Lee la sesión real
 * (ver lib/auth/session.ts) — a diferencia de la versión anterior a PRO-44,
 * ya no es un stub fijo.
 *
 * Invariante: solo se llama desde páginas ya protegidas por
 * app/(app)/layout.tsx, que redirige a /login antes de renderizar si no
 * hay sesión válida. Llegar aquí sin sesión es un error de programación
 * (llamar a esta función fuera de ese árbol protegido), no un caso de
 * usuario real — por eso lanza en vez de devolver un valor por defecto.
 */
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "employee";
};

export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("getCurrentUser() llamado sin sesión activa");
  }
  return { id: user.userId, name: user.name, email: user.email, role: user.role };
}
