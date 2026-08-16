import { getCurrentUser } from "@/lib/auth/currentUser";
import { EmpleadosScreen } from "@/components/empleados/EmpleadosScreen";
import { UnauthorizedScreen } from "@/components/shared/UnauthorizedScreen";

export default async function EmpleadosPage() {
  const user = await getCurrentUser();
  if (user.role !== "owner") return <UnauthorizedScreen />;
  return <EmpleadosScreen />;
}
