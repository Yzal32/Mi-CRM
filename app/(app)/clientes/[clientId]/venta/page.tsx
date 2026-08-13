import { RegistrarVentaScreen } from "@/components/clientes/RegistrarVentaScreen";

export default async function RegistrarVentaPage({ params }: PageProps<"/clientes/[clientId]/venta">) {
  const { clientId } = await params;
  return <RegistrarVentaScreen clientId={clientId} />;
}
