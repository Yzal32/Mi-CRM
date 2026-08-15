import { RestablecerContrasenaScreen } from "@/components/auth/RestablecerContrasenaScreen";

export default async function RestablecerContrasenaPage({ params }: PageProps<"/restablecer-contrasena/[token]">) {
  const { token } = await params;
  return <RestablecerContrasenaScreen token={token} />;
}
