import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { NuevoEmpleadoScreen } from "@/components/empleados/NuevoEmpleadoScreen";

export default async function NuevoEmpleadoPage() {
  const user = await getCurrentUser();
  // Protección mínima: PRO-46 es quien construye la pantalla de "no
  // autorizado" pulida y oculta el enlace en la navegación. Aquí basta con
  // no dejar pasar a un Empleado — igual criterio que PRO-49 ("no accesible
  // para cuentas con rol Empleado").
  if (user.role !== "owner") redirect("/");
  return <NuevoEmpleadoScreen />;
}
