import { AdminClaimDetailView } from "@/components/admin/modules/AdminClaimDetailView";

export default async function AdminClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminClaimDetailView id={id} />;
}
