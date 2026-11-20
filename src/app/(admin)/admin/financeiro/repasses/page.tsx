import { AdminUnavailableView } from "@/components/admin/modules/AdminUnavailableView";

export default function AdminPayoutsPage() {
  return <AdminUnavailableView title="Repasses" description="Acompanhamento e liquidação de valores devidos aos vendedores." missingCapability="O backend atual não possui modelo nem endpoints administrativos de repasse. Esta página não cria, marca ou simula pagamentos." />;
}
