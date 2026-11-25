"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { HandCoins } from "lucide-react";
import { listAdminOrders, type AdminSellerOrder } from "@/lib/api/admin";
import { formatMoney } from "@/features/admin/utils/currency";
import { isPaidOrder } from "@/features/admin/selectors/apiOverview";
import { AdminPageHeader } from "../shared/AdminPageHeader";
import { AdminMetricCard, AdminMetricsRow } from "../shared/AdminMetricCard";
import { AdminDataTable, sharedStyles as styles } from "../shared/AdminDataTable";

export function ConnectedPayoutsView() {
  const [orders, setOrders] = useState<AdminSellerOrder[] | null>(null);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  useEffect(() => { let active = true; listAdminOrders({ limit: 100 }).then(page => { if (active) { setOrders(page.items.filter(isPaidOrder)); setMore(page.pageInfo.hasNextPage); } }).catch(() => { if (active) setError("Não foi possível consultar as previsões de repasse."); }); return () => { active = false; }; }, []);
  const complete = orders?.every(row => row.financialSnapshot);
  return <div className={styles.stack}>
    <AdminPageHeader title="Repasses" description="Previsões financeiras por loja e pedido" icon={<HandCoins size={18} />} actions={<button className={styles.btn} disabled>Novo lote de repasse</button>} />
    <p className={styles.subtitle}>Transferências indisponíveis. Os valores abaixo são previsões dos pedidos, não lotes pagos. Consulta dos 100 registros mais recentes. {more && "Há mais registros; consulte o financeiro para navegar por todos."}</p>
    <AdminMetricsRow><AdminMetricCard label="Líquido previsto no recorte" value={complete && orders ? formatMoney(orders.reduce((sum, row) => sum + row.sellerNetCents, 0)) : "—"} /><AdminMetricCard label="Repasses executados" value="—" hint="Integração indisponível" /></AdminMetricsRow>
    {error ? <p role="alert">{error}</p> : !orders ? <p role="status">Carregando previsões…</p> : <AdminDataTable caption="Previsões de repasse" rows={orders} columns={[{ key: "order", header: "Pedido", render: row => row.order.orderNumber }, { key: "seller", header: "Loja", render: row => row.sellerId }, { key: "net", header: "Líquido previsto", render: row => row.financialSnapshot ? formatMoney(row.sellerNetCents) : "—" }]} mobileCard={row => <><strong>{row.order.orderNumber}</strong><span>{row.sellerId}</span><span>{row.financialSnapshot ? formatMoney(row.sellerNetCents) : "—"}</span></>} />}
    <Link href="/admin/financeiro" className={styles.linkBtn}>Consultar todos os registros financeiros</Link>
  </div>;
}
