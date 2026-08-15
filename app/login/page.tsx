import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { getSessionUser } from "@/lib/auth/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; passwordReset?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect(user.mustChangePassword ? "/cambiar-contrasena" : "/");
  // ?error=... llega tras un redirect de vuelta desde
  // /api/auth/google/callback (PRO-63) cuando el login con Google falla.
  // ?passwordReset=1 llega tras restablecer la contraseña por email (PRO-67).
  const { error, passwordReset } = await searchParams;
  return <LoginScreen initialErrorCode={error} showPasswordResetToast={passwordReset === "1"} />;
}
