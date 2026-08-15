import { RecuperarContrasenaScreen } from "@/components/auth/RecuperarContrasenaScreen";

export default async function RecuperarContrasenaPage({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  const { enviado } = await searchParams;
  return <RecuperarContrasenaScreen showSentToast={enviado === "1"} />;
}
