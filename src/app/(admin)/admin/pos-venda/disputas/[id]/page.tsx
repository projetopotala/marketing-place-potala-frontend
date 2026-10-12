import { AdminDisputeDetailView } from "@/components/admin/modules/AdminDisputeDetailView";

export default async function AdminDisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminDisputeDetailView id={id} />;
}
