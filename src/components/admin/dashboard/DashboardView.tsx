"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChartNoAxesCombined, Package, ShoppingBag, Store, Truck, WalletCards } from "lucide-react";
import { ADMIN_SELLER_STATUS_LABEL, listAdminOrders, listAdminSellers, type AdminSeller, type AdminSellerOrder } from "@/lib/api/admin";
import { listPublicProducts, type PublicProduct } from "@/lib/api/catalog-public";
import { ApiError } from "@/lib/api/client";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/api/orders";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminMetricCard } from "@/components/admin/shared/AdminMetricCard";
import { AdminEmptyState, AdminStatusBadge } from "@/components/admin/shared/AdminStatusBadge";
import { sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { MarketplaceGrowthChart } from "@/components/admin/charts/MarketplaceGrowthChart";
import { SalesByCategoryChart } from "@/components/admin/charts/SalesByCategoryChart";
import { SalesPerformanceChart } from "@/components/admin/charts/SalesPerformanceChart";
import { FadeIn } from "@/components/ui/motion/FadeIn";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion/StaggerContainer";
import adminStyles from "@/components/admin/admin.module.css";

const LIMIT = 100;
const PAID: OrderStatus[] = ["PAID", "FULFILLING", "COMPLETED"];
type Data = { sellers: AdminSeller[]; products: PublicProduct[]; orders: AdminSellerOrder[]; more: { sellers: boolean; products: boolean; orders: boolean } };

const icons = { sellers: Store, products: Package, today: ShoppingBag, month: ChartNoAxesCombined, revenue: WalletCards, delivery: Truck };
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: string) => new Date(value).toLocaleDateString("pt-BR");
const paid = (order: AdminSellerOrder) => PAID.includes(order.order.status);
const sellerTone = (status: AdminSeller["status"]) => status === "ACTIVE" ? "success" as const : status === "PENDING" ? "warning" as const : status === "SUSPENDED" ? "danger" as const : "muted" as const;
const orderTone = (status: OrderStatus) => status === "PAID" || status === "COMPLETED" ? "success" as const : status === "FULFILLING" ? "info" as const : status === "PENDING_PAYMENT" ? "warning" as const : "danger" as const;

function sameDay(value: string, now: Date) {
  const valueDate = new Date(value);
  return valueDate.getFullYear() === now.getFullYear() && valueDate.getMonth() === now.getMonth() && valueDate.getDate() === now.getDate();
}

function salesSeries(orders: AdminSellerOrder[], days: number) {
  const first = new Date();
  first.setHours(0, 0, 0, 0);
  first.setDate(first.getDate() - days + 1);
  const points = new Map<string, { label: string; revenueCents: number; orders: number }>();
  for (let offset = 0; offset < days; offset += 1) {
    const point = new Date(first);
    point.setDate(first.getDate() + offset);
    points.set(point.toISOString().slice(0, 10), { label: point.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }), revenueCents: 0, orders: 0 });
  }
  for (const order of orders) {
    const bucket = points.get(new Date(order.createdAt).toISOString().slice(0, 10));
    if (!bucket) continue;
    bucket.orders += 1;
    if (paid(order)) bucket.revenueCents += order.subtotalCents;
  }
  return [...points.values()];
}

/** Composição clássica com fontes reais existentes; sem seeds históricos. */
export function DashboardView() {
  const [data, setData] = useState<Data | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [sellerPage, productPage, orderPage] = await Promise.all([
        listAdminSellers({ limit: LIMIT }), listPublicProducts({ limit: LIMIT }), listAdminOrders({ limit: LIMIT }),
      ]);
      setData({ sellers: sellerPage.items, products: productPage.items, orders: orderPage.items, more: { sellers: sellerPage.pageInfo.hasNextPage, products: productPage.pageInfo.hasNextPage, orders: orderPage.pageInfo.hasNextPage } });
    } catch (cause) {
      setData(null);
      setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar os dados do dashboard.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [load]);

  const view = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const active = data.sellers.filter((seller) => seller.status === "ACTIVE");
    const pendingSellers = data.sellers.filter((seller) => seller.status === "PENDING");
    const suspended = data.sellers.filter((seller) => seller.status === "SUSPENDED");
    const paidOrders = data.orders.filter(paid);
    const pendingOrders = data.orders.filter((order) => order.order.status === "PENDING_PAYMENT");
    const monthly = paidOrders.filter((order) => new Date(order.createdAt).getFullYear() === now.getFullYear() && new Date(order.createdAt).getMonth() === now.getMonth());
    const productById = new Map(data.products.map((product) => [product.id, product]));
    const sellerById = new Map(data.sellers.map((seller) => [seller.id, seller]));
    const sellerStats = new Map(data.sellers.map((seller) => [seller.id, { products: 0, orders: 0 }]));
    for (const product of data.products) { const stats = sellerStats.get(product.sellerId) ?? { products: 0, orders: 0 }; stats.products += 1; sellerStats.set(product.sellerId, stats); }
    for (const order of data.orders) { const stats = sellerStats.get(order.sellerId) ?? { products: 0, orders: 0 }; stats.orders += 1; sellerStats.set(order.sellerId, stats); }
    const categories = new Map<string, number>();
    const top = new Map<string, { title: string; quantity: number; cents: number }>();
    for (const order of paidOrders) for (const item of order.items) {
      const category = productById.get(item.productId)?.category.name ?? "Sem categoria disponível";
      categories.set(category, (categories.get(category) ?? 0) + item.lineTotalCents);
      const product = top.get(item.productId) ?? { title: item.productTitle, quantity: 0, cents: 0 };
      product.quantity += item.quantity; product.cents += item.lineTotalCents; top.set(item.productId, product);
    }
    return { active, pendingSellers, suspended, paidOrders, pendingOrders, monthly, sellerById, sellerStats, series: salesSeries(data.orders, days), categorySeries: [...categories.entries()].map(([label, value]) => ({ id: label, label, value })).sort((a, b) => b.value - a.value).slice(0, 6), top: [...top.values()].sort((a, b) => b.cents - a.cents).slice(0, 5), recentSellers: [...data.sellers].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6), recentOrders: [...data.orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6) };
  }, [data, days]);

  if (loading && !data) return <div className={sharedStyles.skeleton} aria-busy="true" />;
  if (!data || !view) return <AdminEmptyState title="Não foi possível carregar o dashboard" description={error ?? "Tente novamente."} />;

  const now = new Date();
  const revenue = view.paidOrders.reduce((sum, order) => sum + order.subtotalCents, 0);
  const today = data.orders.filter((order) => sameDay(order.createdAt, now)).length;
  const running = data.orders.filter((order) => order.order.status === "FULFILLING").length;
  const cards = [
    { id: "sellers", label: "Vendedores ativos", value: String(view.active.length), hint: `${view.pendingSellers.length} pendentes` },
    { id: "products", label: "Produtos ativos", value: `${data.products.length}${data.more.products ? "+" : ""}`, hint: "Na vitrine pública" },
    { id: "today", label: "Pedidos hoje", value: String(today), hint: "Linhas de pedido" },
    { id: "month", label: "Vendas do mês", value: money(view.monthly.reduce((sum, order) => sum + order.subtotalCents, 0)), hint: "Bruto aprovado" },
    { id: "revenue", label: "Receita aprovada", value: money(revenue), hint: `Até ${data.orders.length}${data.more.orders ? "+" : ""} linhas recentes` },
    { id: "delivery", label: "Entregas em andamento", value: String(running), hint: "Em separação ou envio" },
  ];

  return <div className={sharedStyles.stack}>
    <FadeIn><AdminPageHeader title="Painel do Marketplace" description="Visão consolidada de vendedores, produtos e pedidos recentes." icon={<ChartNoAxesCombined size={18} strokeWidth={1.75} aria-hidden="true" />} /></FadeIn>
    {error ? <AdminEmptyState title="Dados parcialmente indisponíveis" description={error} /> : null}
    <StaggerContainer className={sharedStyles.metrics}>{cards.map((card) => <StaggerItem key={card.id}><AdminMetricCard {...card} icon={icons[card.id as keyof typeof icons]} /></StaggerItem>)}</StaggerContainer>
    <section className={adminStyles.chartsRow} aria-label="Gráficos do dashboard">
      <div className={adminStyles.panel}><div className={adminStyles.panelHead}><h2 className={adminStyles.panelTitle}>Desempenho de vendas</h2><select className={adminStyles.select} value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Período do gráfico"><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option></select></div><SalesPerformanceChart data={view.series} /></div>
      <SalesByCategoryChart data={view.categorySeries} />
      <MarketplaceGrowthChart data={view.series} />
    </section>
    <section className={adminStyles.tablesRow} aria-label="Tabelas operacionais">
      <article className={adminStyles.panel}><div className={adminStyles.panelHead}><h2 className={adminStyles.panelTitle}>Vendedores em destaque</h2><Link href="/admin/vendedores" className={sharedStyles.linkBtn}>Ver todos</Link></div><div className={`${adminStyles.tableScroll} ${adminStyles.dashboardTableScroll}`}>{view.recentSellers.length === 0 ? <AdminEmptyState title="Nenhum vendedor cadastrado" /> : <table className={adminStyles.table}><thead><tr><th>Loja</th><th>Status</th><th>Produtos*</th><th>Pedidos*</th><th>Comissão</th></tr></thead><tbody>{view.recentSellers.map((seller) => { const stats = view.sellerStats.get(seller.id) ?? { products: 0, orders: 0 }; return <tr key={seller.id}><td>{seller.tradeName}</td><td><AdminStatusBadge label={ADMIN_SELLER_STATUS_LABEL[seller.status]} tone={sellerTone(seller.status)} /></td><td>{stats.products}</td><td>{stats.orders}</td><td>{seller.commissionBps == null ? "—" : `${seller.commissionBps / 100}%`}</td></tr>; })}</tbody></table>}</div><p className={adminStyles.alertDetail}>*Contagens na página atual de dados.</p></article>
      <article className={adminStyles.panel}><div className={adminStyles.panelHead}><h2 className={adminStyles.panelTitle}>Pedidos recentes</h2><Link href="/admin/pedidos" className={sharedStyles.linkBtn}>Ver todos</Link></div><div className={`${adminStyles.tableScroll} ${adminStyles.dashboardTableScroll}`}>{view.recentOrders.length === 0 ? <AdminEmptyState title="Nenhum pedido recente" /> : <table className={adminStyles.table}><thead><tr><th>Pedido</th><th>Loja</th><th>Valor</th><th>Status</th></tr></thead><tbody>{view.recentOrders.map((order) => <tr key={order.id}><td>{order.order.orderNumber}</td><td>{view.sellerById.get(order.sellerId)?.tradeName ?? "Loja indisponível"}</td><td>{money(order.subtotalCents)}</td><td><AdminStatusBadge label={ORDER_STATUS_LABEL[order.order.status]} tone={orderTone(order.order.status)} /></td></tr>)}</tbody></table>}</div></article>
    </section>
    <section className={adminStyles.bottomRow} aria-label="Resumo e pendências">
      <article className={adminStyles.panel}><h2 className={adminStyles.panelTitle}>Resumo financeiro</h2><div className={adminStyles.financeList}><div className={adminStyles.financeRow}><span className={adminStyles.financeLabel}>Bruto aprovado</span><strong className={adminStyles.financeValue}>{money(revenue)}</strong></div><div className={adminStyles.financeRow}><span className={adminStyles.financeLabel}>Aguardando pagamento</span><strong className={adminStyles.financeValue}>{money(view.pendingOrders.reduce((sum, order) => sum + order.subtotalCents, 0))}</strong></div><div className={adminStyles.financeRow}><span className={adminStyles.financeLabel}>Pedidos aprovados</span><strong className={adminStyles.financeValue}>{view.paidOrders.length}</strong></div></div><Link href="/admin/financeiro" className={sharedStyles.linkBtn}>Ver financeiro</Link></article>
      <article className={adminStyles.panel}><h2 className={adminStyles.panelTitle}>Alertas</h2><div className={adminStyles.alertList}><div className={adminStyles.alertItem}><h3 className={adminStyles.alertTitle}>{view.pendingSellers.length} vendedores pendentes</h3><p className={adminStyles.alertDetail}>Cadastros aguardando revisão.</p></div><div className={adminStyles.alertItem}><h3 className={adminStyles.alertTitle}>{view.pendingOrders.length} pagamentos pendentes</h3><p className={adminStyles.alertDetail}>Linhas de pedido aguardando pagamento.</p></div><div className={adminStyles.alertItem}><h3 className={adminStyles.alertTitle}>{view.suspended.length} vendedores suspensos</h3><p className={adminStyles.alertDetail}>Requerem acompanhamento administrativo.</p></div></div></article>
      <article className={adminStyles.panel}><h2 className={adminStyles.panelTitle}>Aprovações pendentes</h2><div className={adminStyles.approvalList}>{view.pendingSellers.length === 0 ? <AdminEmptyState title="Nenhuma aprovação pendente" /> : view.pendingSellers.slice(0, 4).map((seller) => <div key={seller.id} className={adminStyles.approvalItem}><h3 className={adminStyles.approvalTitle}>{seller.tradeName}</h3><p className={adminStyles.approvalDesc}>{seller.email} · {date(seller.createdAt)}</p></div>)}</div><Link href="/admin/vendedores" className={sharedStyles.linkBtn}>Revisar vendedores</Link></article>
      <article className={adminStyles.panel}><h2 className={adminStyles.panelTitle}>Top produtos</h2><div className={adminStyles.financeList}>{view.top.length === 0 ? <AdminEmptyState title="Sem vendas aprovadas" /> : view.top.map((product) => <div key={product.title} className={adminStyles.financeRow}><span className={adminStyles.financeLabel}>{product.title} · {product.quantity} un.</span><strong className={adminStyles.financeValue}>{money(product.cents)}</strong></div>)}</div></article>
    </section>
  </div>;
}
