import { redirect } from "next/navigation";
import { CambiarContrasenaScreen } from "@/components/auth/CambiarContrasenaScreen";
import { getSessionUser } from "@/lib/auth/session";

// Accesible con CUALQUIER sesión válida, no solo mustChangePassword: true —
// sirve tanto para el cambio obligatorio (bloqueado por
// app/(app)/layout.tsx hasta completarlo) como para el voluntario desde
// Ajustes (PRO-57). mustChangePassword solo decide el subtítulo aquí.
export default async function CambiarContrasenaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <CambiarContrasenaScreen mandatory={user.mustChangePassword} />;
}
