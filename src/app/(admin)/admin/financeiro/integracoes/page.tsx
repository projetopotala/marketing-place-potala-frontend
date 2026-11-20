import { AdminUnavailableView } from "@/components/admin/modules/AdminUnavailableView";

export default function AdminIntegrationsPage() {
  return <AdminUnavailableView title="Integrações financeiras" description="Configuração de provedores de pagamento e conciliação." missingCapability="O backend atual não disponibiliza uma API administrativa de integrações de pagamento. Nenhum status de gateway é exibido para evitar dados fictícios." />;
}
