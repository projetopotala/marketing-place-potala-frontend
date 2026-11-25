import { ConnectedDetailView } from "@/components/admin/modules/ConnectedDetailView";

export default async function AdminContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConnectedDetailView key={id} id={id} resource="conteudos" />;
}
