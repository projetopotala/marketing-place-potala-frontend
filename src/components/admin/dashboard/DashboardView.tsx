"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChartNoAxesCombined, Package, ShoppingBag, Store, Truck, WalletCards } from "lucide-react";
import { listAdminSellers, listAdminProducts, listAdminOrders, listAdminCategories, ADMIN_SELLER_STATUS_LABEL, type AdminSeller, type AdminProduct, type AdminSellerOrder, type AdminCategory } from "@/lib/api/admin";
import { SELLER_ORDER_STATUS_LABEL } from "@/lib/api/orders";
import { buildApiOverview } from "@/features/admin/selectors/apiOverview";
import { formatMoney } from "@/features/admin/utils/currency";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminMetricCard } from "@/components/admin/shared/AdminMetricCard";
import { AdminStatusBadge, AdminEmptyState } from "@/components/admin/shared/AdminStatusBadge";
import { sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { SalesPerformanceChart } from "@/components/admin/charts/SalesPerformanceChart";
import { SalesByCategoryChart } from "@/components/admin/charts/SalesByCategoryChart";
import { MarketplaceGrowthChart } from "@/components/admin/charts/MarketplaceGrowthChart";
import { FadeIn } from "@/components/ui/motion/FadeIn";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion/StaggerContainer";
import styles from "@/components/admin/admin.module.css";

const LIMIT = 100;
function Panel({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return <div className={styles.panel}><div className={styles.panelHead}><h2 className={styles.panelTitle}>{title}</h2>{href && <Link href={href} className={sharedStyles.linkBtn}>Ver todos</Link>}</div>{children}</div>;
}

export function DashboardView() {
  const [sellers, setSellers] = useState<AdminSeller[] | null>(null);
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [orders, setOrders] = useState<AdminSellerOrder[] | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [partial, setPartial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([listAdminSellers({ limit: LIMIT }), listAdminProducts({ limit: LIMIT }), listAdminOrders({ limit: LIMIT }), listAdminCategories()]).then(([s, p, o, c]) => {
      if (cancelled) return;
      setSellers(s.status === "fulfilled" ? s.value.items : null);
      setProducts(p.status === "fulfilled" ? p.value.items : null);
      setOrders(o.status === "fulfilled" ? o.value.items : null);
      setCategories(c.status === "fulfilled" ? c.value : []);
      setErrors([s, p, o, c].flatMap((result, index) => result.status === "rejected" ? [`Não foi possível carregar ${["vendedores", "produtos", "pedidos", "categorias"][index]}.`] : []));
      setPartial([s, p, o].some(result => result.status === "fulfilled" && result.value.pageInfo.hasNextPage));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [revision]);

  const data = useMemo(() => buildApiOverview(orders ?? [], products ?? [], categories, days), [orders, products, categories, days]);
  const money = (value: number | null) => orders && value != null ? formatMoney(value) : "—";
  const metrics = [
    { label: "Vendedores", value: sellers ? String(sellers.length) : "—", hint: "No recorte carregado", icon: Store },
    { label: "Produtos ativos", value: products ? String(products.filter(product => product.status === "ACTIVE").length) : "—", hint: "No recorte carregado", icon: Package },
    { label: "Pedidos hoje", value: orders ? String(data.todayCount) : "—", hint: "Pedidos únicos no recorte", icon: ShoppingBag },
    { label: "Vendas no período", value: money(data.paidCents), hint: "Bruto pago antes de descontos", icon: ChartNoAxesCombined },
    { label: "Comissões previstas", value: money(data.commissionCents), hint: "Somente com registro financeiro", icon: WalletCards },
    { label: "Entregas em andamento", value: orders ? String(data.shipments) : "—", hint: "Remessas no período", icon: Truck },
  ];
  const unavailable = <AdminEmptyState title="Dados indisponíveis" description="Tente carregar novamente." />;
  if (loading) return <div className={sharedStyles.skeleton} aria-busy="true" />;

  return <div className={sharedStyles.stack}>
    <FadeIn><AdminPageHeader title="Painel do Marketplace" description="Visão geral e controle completo do marketplace" icon={<ChartNoAxesCombined size={18} />} actions={<button className={sharedStyles.btnSecondary} onClick={() => { setLoading(true); setRevision(value => value + 1); }}>Atualizar</button>} /></FadeIn>
    <p className={sharedStyles.subtitle}>Indicadores sobre até {LIMIT} registros recentes de cada lista. {partial ? "Há mais registros fora deste recorte. " : ""}Vendas e gráficos: últimos {days} dias; valores brutos antes de descontos.</p>
    {errors.length > 0 && <p role="alert">{errors.join(" ")}</p>}
    <StaggerContainer className={sharedStyles.metrics}>{metrics.map(metric => <StaggerItem key={metric.label}><AdminMetricCard {...metric} /></StaggerItem>)}</StaggerContainer>
    <section className={styles.chartsRow} aria-label="Gráficos">
      <div className={styles.panel}><div className={styles.panelHead}><h2 className={styles.panelTitle}>Desempenho de Vendas</h2><select className={styles.select} aria-label="Período do gráfico" value={days} onChange={event => setDays(Number(event.target.value))}>{[7, 30, 90].map(value => <option key={value} value={value}>Últimos {value} dias</option>)}</select></div>{orders ? <SalesPerformanceChart data={data.sales} /> : unavailable}</div>
      <Panel title="Vendas por Categoria">{orders ? <SalesByCategoryChart data={data.categories} /> : unavailable}</Panel>
      <Panel title="Crescimento do marketplace">{orders ? <MarketplaceGrowthChart data={data.sales} /> : unavailable}</Panel>
    </section>
    <section className={styles.tablesRow}>
      <Panel title="Vendedores em destaque" href="/admin/vendedores">{sellers ? <div className={`${styles.tableScroll} ${styles.dashboardTableScroll}`}><table className={styles.table}><thead><tr><th>Loja</th><th>Status</th><th>Produtos</th><th>Comissão</th></tr></thead><tbody>{[...sellers].sort((a, b) => (data.sellerTotals.find(row => row.id === b.id)?.value ?? 0) - (data.sellerTotals.find(row => row.id === a.id)?.value ?? 0)).slice(0, 5).map(seller => <tr key={seller.id}><td>{seller.tradeName}</td><td><AdminStatusBadge label={ADMIN_SELLER_STATUS_LABEL[seller.status]} tone={seller.status === "ACTIVE" ? "success" : "warning"} /></td><td>{products ? products.filter(product => product.sellerId === seller.id).length : "—"}</td><td>{seller.commissionBps == null ? "—" : `${seller.commissionBps / 100}%`}</td></tr>)}</tbody></table>{sellers.length === 0 && <AdminEmptyState title="Nenhum vendedor cadastrado" />}</div> : unavailable}</Panel>
      <Panel title="Pedidos recentes" href="/admin/pedidos">{orders ? <div className={`${styles.tableScroll} ${styles.dashboardTableScroll}`}><table className={styles.table}><thead><tr><th>Pedido</th><th>Loja</th><th>Valor bruto</th><th>Status</th></tr></thead><tbody>{data.recent.map(row => <tr key={row.id}><td>{row.order.orderNumber}</td><td>{sellers?.find(seller => seller.id === row.sellerId)?.tradeName ?? row.sellerId}</td><td>{formatMoney(row.subtotalCents)}</td><td><AdminStatusBadge label={SELLER_ORDER_STATUS_LABEL[row.status]} tone="info" /></td></tr>)}</tbody></table>{data.recent.length === 0 && <AdminEmptyState title="Nenhum pedido no período" />}</div> : unavailable}</Panel>
    </section>
    <section className={styles.bottomRow}>
      <Panel title="Resumo financeiro" href="/admin/financeiro"><div className={styles.financeList}>{[{ label: "Bruto pago", value: data.paidCents }, { label: "Aguardando pagamento", value: data.pendingCents }, { label: "Comissões previstas", value: data.commissionCents }, { label: "Líquido previsto", value: data.netCents }].map(row => <div className={styles.financeRow} key={row.label}><span className={styles.financeLabel}>{row.label}</span><span className={styles.financeValue}>{money(row.value)}</span></div>)}</div><p className={sharedStyles.subtitle}>Valores previstos não comprovam repasse.</p></Panel>
      <Panel title="Alertas"><div className={styles.alertList}><article className={styles.alertItem}><h3 className={styles.alertTitle}>Estoque baixo</h3><p className={styles.alertDetail}>{products ? `${products.filter(product => product.variants.reduce((sum, variant) => sum + variant.inventory.quantity, 0) < 5).length} produtos com menos de 5 unidades no recorte.` : "Estoque indisponível."}</p></article><article className={styles.alertItem}><h3 className={styles.alertTitle}>Integrações de pagamento</h3><p className={styles.alertDetail}>Gateway indisponível. Repasses e estornos não são executados pelo painel.</p></article></div></Panel>
      <Panel title="Aprovações pendentes"><div className={styles.approvalList}>{[{ label: "Vendedores", count: sellers ? sellers.filter(row => row.status === "PENDING").length : "—", href: "/admin/vendedores" }, { label: "Produtos em revisão", count: products ? products.filter(row => row.status === "REVIEW").length : "—", href: "/admin/produtos" }].map(item => <article className={styles.approvalItem} key={item.href}><h3 className={styles.approvalTitle}><Link className={sharedStyles.linkBtn} href={item.href}>{item.label}</Link><span className={styles.approvalCount}>{item.count}</span></h3><p className={styles.approvalDesc}>No recorte carregado</p></article>)}</div></Panel>
      <Panel title="Top produtos">{orders ? <div className={styles.financeList}>{data.topProducts.map(product => <div className={styles.financeRow} key={product.id}><span className={styles.financeLabel}>{product.title} · {product.quantity} un.</span><span className={styles.financeValue}>{formatMoney(product.revenueCents)}</span></div>)}{data.topProducts.length === 0 && <AdminEmptyState title="Sem vendas no período" />}</div> : unavailable}</Panel>
    </section>
  </div>;
}
