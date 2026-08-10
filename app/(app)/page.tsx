import { HoyScreen } from "@/components/hoy/HoyScreen";

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordChanged?: string }>;
}) {
  const { passwordChanged } = await searchParams;
  return <HoyScreen showPasswordChangedToast={passwordChanged === "1"} />;
}
