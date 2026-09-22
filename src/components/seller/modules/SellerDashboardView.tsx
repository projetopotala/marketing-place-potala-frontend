"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SalesPerformanceChart } from "@/components/admin/charts/SalesPerformanceChart";
import { ApiError } from "@/lib/api/client";
import {
  listSellerProducts,
  totalStock,
  type SellerProduct,
} from "@/lib/api/catalog";
import {
  listMySellerOrders,
  SELLER_ORDER_STATUS_LABEL,
  type SellerOrderForSellerResponse,
} from "@/lib/api/orders";
import styles from "@/components/seller/seller.module.css";

/**
 * Quantos itens buscar de cada lista pra montar as métricas. O backend só
 * pagina por cursor (sem endpoint de agregação/contagem — nenhum serviço
 * deste projeto tem um), então "vendas", "pedidos" etc. aqui são uma
 * aproximação sobre até LIMIT itens mais recentes, não o histórico
 * completo da loja — mesmo padrão de aproximação já usado em
 * /minha-conta (ver status-migracao-microservicos.md). Quando há mais
 * itens do que o buscado, o número aparece com um "+".
 */
const LIMIT = 100;
const LOW_STOCK_THRESHOLD = 5;

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatCount(count: number, hasMore: boolean): string {
  return hasMore ? `${count}+` : `${count}`;
}

interface DashboardMetrics {
  salesCents: number;
  ordersCount: number;
  ordersHasMore: boolean;
  avgTicketCents: number;
  activeProducts: number;
  productsHasMore: boolean;
  lowStock: number;
  recentOrders: SellerOrderForSellerResponse[];
  topProducts: SellerProduct[];
  series: Array<{ label: string; revenueCents: number; orders: number }>;
  alerts: string[];
}

function buildMetrics(
  products: SellerProduct[],
  productsHasMore: boolean,
  orders: SellerOrderForSellerResponse[],
  ordersHasMore: boolean,
): DashboardMetrics {
  const salesCents = orders.reduce((sum, order) => sum + order.subtotalCents, 0);
  // Nota: SellerOrderResponse.sellerNetCents sempre vem 0 nesta v1 do
  // orders-service (comissao/frete por vendedor ainda nao sao calculados --
  // ver o comentario em OrdersService.createOrderRecords, potala-orders-
  // service) -- por isso nao existe cartao "Total liquido" aqui: mostrar um
  // numero que e sempre zero por design pareceria um calculo real e nao e.
  const avgTicketCents = orders.length === 0 ? 0 : Math.round(salesCents / orders.length);

  const activeProducts = products.filter((product) => product.status === "ACTIVE").length;
  const lowStock = products.filter((product) => {
    const stock = totalStock(product);
    return stock > 0 && stock <= LOW_STOCK_THRESHOLD;
  }).length;

  const recentOrders = [...orders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const topProducts = products
    .filter((product) => product.status === "ACTIVE")
    .slice(0, 5);

  const buckets = new Map<string, { revenueCents: number; orders: number }>();
  for (const order of orders) {
    const day = order.createdAt.slice(0, 10);
    const current = buckets.get(day) ?? { revenueCents: 0, orders: 0 };
    current.revenueCents += order.subtotalCents;
    current.orders += 1;
    buckets.set(day, current);
  }
  const series = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([day, value]) => ({
      label: day.slice(5),
      revenueCents: value.revenueCents,
      orders: value.orders,
    }));

  const alerts: string[] = [];
  if (lowStock > 0) {
    alerts.push(`${lowStock} produto(s) com estoque baixo (${LOW_STOCK_THRESHOLD} unidades ou menos).`);
  }
  if (orders.some((order) => order.status === "PENDING")) {
    alerts.push("Há pedidos pendentes aguardando confirmação.");
  }

  return {
    salesCents,
    ordersCount: orders.length,
    ordersHasMore,
    avgTicketCents,
    activeProducts,
    productsHasMore,
    lowStock,
    recentOrders,
    topProducts,
    series,
    alerts,
  };
}

/**
 * Painel real via GET /seller/products e GET /seller/orders (catalog-service
 * e orders-service, através do gateway) — substitui o mock antigo baseado
 * em AdminDataContext/selectSellerDashboardMetrics. "Saldo disponível" e o
 * gráfico de formas de pagamento da versão mock foram removidos: não existe
 * model de repasse/payout nem breakdown de forma de pagamento por vendedor
 * em nenhum backend real (PaymentTransaction pertence ao Order do cliente,
 * não é exposto por /seller/orders) — ver status-migracao-microservicos.md.
 */
export function SellerDashboardView() {
  const [products, setProducts] = useState<SellerProduct[] | null>(null);
  const [productsHasMore, setProductsHasMore] = useState(false);
  const [orders, setOrders] = useState<SellerOrderForSellerResponse[] | null>(null);
  const [ordersHasMore, setOrdersHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [productsPage, ordersPage] = await Promise.all([
          listSellerProducts({ limit: LIMIT }),
          listMySellerOrders({ limit: LIMIT }),
        ]);
        if (cancelled) return;
        setProducts(productsPage.items);
        setProductsHasMore(productsPage.pageInfo.hasNextPage);
        setOrders(ordersPage.items);
        setOrdersHasMore(ordersPage.pageInfo.hasNextPage);
      } catch (err) {
        if (cancelled) return;
        setProducts(null);
        setOrders(null);
        setError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar as métricas do painel.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    if (!products || !orders) return null;
    return buildMetrics(products, productsHasMore, orders, ordersHasMore);
  }, [products, productsHasMore, orders, ordersHasMore]);

  if (isLoading) {
    return (
      <p role="status" aria-live="polite">
        Carregando métricas…
      </p>
    );
  }

  if (error || !metrics) {
    return (
      <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
        {error ?? "Não foi possível carregar as métricas do painel."}
      </p>
    );
  }

  return (
    <>
      <header>
        <h1 className={styles.pageTitle}>Painel</h1>
        <p className={styles.pageLead}>
          Indicadores calculados a partir dos seus pedidos e produtos reais
          (até os {LIMIT} mais recentes de cada).
        </p>
      </header>

      <section className={styles.metrics} aria-label="Indicadores">
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Vendas (subtotal)</p>
          <p className={styles.metricValue}>{formatMoney(metrics.salesCents)}</p>
        </article>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Pedidos</p>
          <p className={styles.metricValue}>
            {formatCount(metrics.ordersCount, metrics.ordersHasMore)}
          </p>
        </article>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Ticket médio</p>
          <p className={styles.metricValue}>
            {formatMoney(metrics.avgTicketCents)}
          </p>
        </article>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Produtos ativos</p>
          <p className={styles.metricValue}>
            {formatCount(metrics.activeProducts, metrics.productsHasMore)}
          </p>
        </article>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Estoque baixo</p>
          <p className={styles.metricValue}>{metrics.lowStock}</p>
        </article>
      </section>

      {metrics.alerts.length > 0 ? (
        <section className={styles.panel} aria-label="Alertas operacionais">
          <h2 className={styles.panelTitle}>Alertas</h2>
          <ul>
            {metrics.alerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <SalesPerformanceChart data={metrics.series} />

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Pedidos recentes</h2>
        {metrics.recentOrders.length === 0 ? (
          <p>Nenhum pedido ainda.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link
                        href={`/loja/pedidos/${order.id}`}
                        className={styles.rowLink}
                      >
                        {order.order.orderNumber}
                      </Link>
                    </td>
                    <td>
                      <span className={styles.badge}>
                        {SELLER_ORDER_STATUS_LABEL[order.status]}
                      </span>
                    </td>
                    <td>{formatMoney(order.subtotalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Produtos em destaque</h2>
        {metrics.topProducts.length === 0 ? (
          <p>Nenhum produto ativo ainda.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Estoque</th>
                  <th>Preço</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <Link
                        href={`/loja/produtos/${product.id}`}
                        className={styles.rowLink}
                      >
                        {product.title}
                      </Link>
                    </td>
                    <td>{totalStock(product)}</td>
                    <td>{formatMoney(product.priceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
