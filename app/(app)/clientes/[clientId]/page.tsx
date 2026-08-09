import { FichaClienteScreen } from "@/components/clientes/FichaClienteScreen";

export default async function FichaClientePage({ params }: PageProps<"/clientes/[clientId]">) {
  const { clientId } = await params;
  return <FichaClienteScreen clientId={clientId} />;
}
