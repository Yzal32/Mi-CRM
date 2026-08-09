import { PlaceholderScreen } from "@/components/shared/PlaceholderScreen";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { logoutAction } from "@/lib/auth/actions";

export default async function AjustesPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-col gap-5">
      <PlaceholderScreen
        title="Ajustes"
        message={`Sesión iniciada como ${user.name} (${user.email}). Próximamente: Gestión de empleados si eres la Dueña.`}
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-5 lg:px-12">
        {/* Cambio voluntario de contraseña (PRO-57) — el obligatorio, con
            mustChangePassword: true, pasa por aquí igual, ver
            app/cambiar-contrasena/page.tsx. */}
        <Button href="/cambiar-contrasena" variant="secondary" className="w-full lg:w-auto">
          Cambiar contraseña
        </Button>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary" className="w-full lg:w-auto">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </div>
  );
}
