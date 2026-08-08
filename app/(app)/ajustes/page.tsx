import { PlaceholderScreen } from "@/components/shared/PlaceholderScreen";
import { getCurrentUser } from "@/lib/auth/currentUser";

export default function AjustesPage() {
  const user = getCurrentUser();
  return (
    <PlaceholderScreen
      title="Ajustes"
      message={`Sesión iniciada como ${user.name} (${user.email}). Próximamente: Mi cuenta y, si eres la Dueña, Gestión de empleados.`}
    />
  );
}
