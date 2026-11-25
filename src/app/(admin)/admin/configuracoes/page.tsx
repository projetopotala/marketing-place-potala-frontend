import { AdminUnavailableView } from "@/components/admin/modules/AdminUnavailableView";

export default function AdminSettingsPage() {
  return <AdminUnavailableView title="Configurações" description="Parâmetros globais do marketplace." missingCapability="Não existe API administrativa para persistir configurações globais do marketplace. Nenhuma configuração local ou demonstrativa é apresentada como configuração de produção." />;
}
