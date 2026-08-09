import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { getSessionUser } from "@/lib/auth/session";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.mustChangePassword ? "/cambiar-contrasena" : "/");
  return <LoginScreen />;
}
