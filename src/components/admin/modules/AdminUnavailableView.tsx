import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/shared/AdminStatusBadge";
import { sharedStyles } from "@/components/admin/shared/AdminDataTable";

type AdminUnavailableViewProps = {
  title: string;
  description: string;
  missingCapability: string;
};

/** Página funcional para recursos cujo contrato de backend ainda não existe. */
export function AdminUnavailableView({ title, description, missingCapability }: AdminUnavailableViewProps) {
  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader title={title} description={description} />
      <AdminEmptyState title="Recurso ainda não disponível" description={missingCapability} />
    </div>
  );
}
