import { getCurrentUser } from "@/lib/auth/currentUser";
import { NuevoEmpleadoScreen } from "@/components/empleados/NuevoEmpleadoScreen";
import { UnauthorizedScreen } from "@/components/shared/UnauthorizedScreen";

export default async function NuevoEmpleadoPage() {
  const user = await getCurrentUser();
  if (user.role !== "owner") return <UnauthorizedScreen />;
  return <NuevoEmpleadoScreen />;
}
