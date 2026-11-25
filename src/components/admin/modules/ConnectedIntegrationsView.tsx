import Link from "next/link";
import { Plug } from "lucide-react";
import { AdminPageHeader } from "../shared/AdminPageHeader";
import { AdminMetricCard, AdminMetricsRow } from "../shared/AdminMetricCard";
import { AdminStatusBadge } from "../shared/AdminStatusBadge";
import styles from "../shared/shared.module.css";

export function ConnectedIntegrationsView() {
  return <div className={styles.stack}>
    <AdminPageHeader title="Integrações de pagamento" description="Conexões e disponibilidade dos meios de pagamento" icon={<Plug size={18} />} actions={<Link href="/admin/financeiro" className={styles.btnGhost}>Voltar ao financeiro</Link>} />
    <AdminMetricsRow>{["Gateways", "Conectados", "Saudáveis"].map(label => <AdminMetricCard key={label} label={label} value="—" hint="Consulta indisponível" />)}</AdminMetricsRow>
    <div className={styles.grid2}><article className={styles.panel}><h2 className={styles.panelTitle}>Gateway de pagamento</h2><AdminStatusBadge label="Indisponível" tone="warning" /><p className={styles.subtitle}>Ainda não é possível conectar um gateway ou consultar sua situação pelo painel. Nenhuma credencial ou conexão é simulada.</p><button type="button" className={styles.btnSecondary} disabled>Conectar gateway</button></article><article className={styles.panel}><h2 className={styles.panelTitle}>Taxas e comissões</h2><p className={styles.subtitle}>As políticas financeiras disponíveis são aplicadas aos próximos pedidos. Elas não confirmam a liquidação de pagamentos.</p><Link href="/admin/configuracoes" className={styles.linkBtn}>Ver configurações</Link></article></div>
  </div>;
}
