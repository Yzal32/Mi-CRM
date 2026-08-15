import { RestablecerContrasenaScreen } from "@/components/auth/RestablecerContrasenaScreen";

export default async function RestablecerContrasenaPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <RestablecerContrasenaScreen initialEmail={email} />;
}
