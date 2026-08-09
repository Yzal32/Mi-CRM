import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/navigation/Sidebar";
import { TabBar } from "@/components/navigation/TabBar";
import { MobileTopBar } from "@/components/navigation/MobileTopBar";
import { ConnectionBanner } from "@/components/shared/ConnectionBanner";
import { getSessionUser } from "@/lib/auth/session";

// Verificación real de sesión (no solo el check optimista de proxy.ts, ver
// su docstring): sin sesión válida, a /login; con mustChangePassword, a
// /cambiar-contrasena antes de dejar usar el resto del CRM. mustChangePassword
// se usa ÚNICAMENTE aquí — /cambiar-contrasena en sí es accesible con
// cualquier sesión válida (también sirve para el cambio voluntario de
// PRO-57), no solo cuando el flag está a true.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/cambiar-contrasena");

  return (
    // id usado por components/ui/Overlay.tsx para aplicar `inert` a todo
    // el árbol de la app mientras un overlay está abierto (portado fuera
    // de este contenedor, a document.body — nunca dentro, o heredaría
    // inert y dejaría de ser interactivo).
    <div id="app-shell" className="flex min-h-full flex-1">
      <Sidebar />
      <div className="flex min-h-full flex-1 flex-col">
        <ConnectionBanner />
        <MobileTopBar />
        <main className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
        <TabBar />
      </div>
    </div>
  );
}
