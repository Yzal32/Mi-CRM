import { PlaceholderScreen } from "@/components/shared/PlaceholderScreen";

export default async function FichaClientePage({ params }: PageProps<"/clientes/[clientId]">) {
  const { clientId } = await params;
  return <PlaceholderScreen title="Ficha de cliente" message={`Próximamente. ID de cliente: ${clientId}`} />;
}
