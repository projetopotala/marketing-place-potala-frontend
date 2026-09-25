"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChartNoAxesCombined,
  ClipboardCheck,
  Package,
  Store,
  Tags,
} from "lucide-react";
import {
  ADMIN_SELLER_STATUS_LABEL,
  listAdminSellers,
  listAdminCategories,
  type AdminSeller,
  type AdminCategory,
} from "@/lib/api/admin";
import { listPublicProducts } from "@/lib/api/catalog-public";
import { ApiError } from "@/lib/api/client";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminMetricCard } from "@/components/admin/shared/AdminMetricCard";
import {
  AdminStatusBadge,
  AdminEmptyState,
} from "@/components/admin/shared/AdminStatusBadge";
import { sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { FadeIn } from "@/components/ui/motion/FadeIn";
import {
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/motion/StaggerContainer";
import adminStyles from "@/components/admin/admin.module.css";
import type { LucideIcon } from "lucide-react";

const LIMIT = 100;

function sellerTone(status: AdminSeller["status"]) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "PENDING") return "warning" as const;
  if (status === "SUSPENDED") return "danger" as const;
  return "muted" as const;
}

function formatCommission(bps: number | null): string {
  if (bps == null) return "—";
  return `${(bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

const METRIC_ICONS: Record<string, LucideIcon> = {
  sellers: Store,
  approvals: ClipboardCheck,
  categories: Tags,
  products: Package,
};

/**
 * Reescrito nesta sessão pra usar dado real (ver "dashboard do admin —
 * versão enxuta real" em status-migracao-microservicos.md, Claude
 * Project). Na época, o backend só tinha dois endpoints de admin de
 * verdade (GET /admin/sellers e GET /admin/categories) — sem nenhum
 * admin-wide de pedidos/financeiro/produtos-por-vendedor em nenhum dos 4
 * serviços. Isso mudou em 24/09: GET /admin/orders (orders-service) já
 * existe e alimenta a tela de Financeiro admin (FinanceView.tsx) — mas
 * este painel aqui continua enxuto de propósito, sem puxar esse endpoint:
 * não é escopo pedido pelo Arthur mexer no dashboard agora, só no
 * Financeiro. Por isso ainda sem gráficos, sem "pedidos recentes" admin,
 * sem "top produtos" aqui — só o que já sustentava com dado real antes:
 * vendedores (com contagem por status), aprovações pendentes, categorias
 * e total de produtos ativos na vitrine pública.
 */
export function DashboardView() {
  const [sellers, setSellers] = useState<AdminSeller[] | null>(null);
  const [sellersHasMore, setSellersHasMore] = useState(false);
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [productsCount, setProductsCount] = useState<number | null>(null);
  const [productsHasMore, setProductsHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listAdminSellers({ limit: LIMIT }),
      listAdminCategories(),
      listPublicProducts({ limit: LIMIT }),
    ])
      .then(([sellersPage, categoriesResult, productsPage]) => {
        if (cancelled) return;
        setSellers(sellersPage.items);
        setSellersHasMore(sellersPage.pageInfo.hasNextPage);
        setCategories(categoriesResult);
        setProductsCount(productsPage.items.length);
        setProductsHasMore(productsPage.pageInfo.hasNextPage);
      })
      .catch((err) => {
        console.error("[admin-dashboard] falha ao carregar indicadores:", err);
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Não foi possível carregar os indicadores do painel.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const sellerCounts = useMemo(() => {
    const counts = { ACTIVE: 0, PENDING: 0, SUSPENDED: 0, REJECTED: 0 };
    for (const seller of sellers ?? []) {
      counts[seller.status] += 1;
    }
    return counts;
  }, [sellers]);

  const pendingSellers = useMemo(
    () => (sellers ?? []).filter((seller) => seller.status === "PENDING"),
    [sellers],
  );

  const recentSellers = useMemo(
    () =>
      [...(sellers ?? [])]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 5),
    [sellers],
  );

  const categoryCounts = useMemo(() => {
    const list = categories ?? [];
    const active = list.filter((category) => category.status === "ACTIVE").length;
    return { total: list.length, active, inactive: list.length - active };
  }, [categories]);

  const metrics = [
    {
      id: "sellers",
      label: "Vendedores",
      value: sellers ? `${sellers.length}${sellersHasMore ? "+" : ""}` : "…",
      hint: sellers
        ? `${sellerCounts.ACTIVE} ativos · ${sellerCounts.PENDING} pendentes · ${sellerCounts.SUSPENDED} suspensos`
        : "Carregando…",
    },
    {
      id: "approvals",
      label: "Aprovações pendentes",
      value: sellers ? String(pendingSellers.length) : "…",
      hint: sellersHasMore
        ? "Pode haver mais em outras páginas"
        : "De todos os vendedores cadastrados",
    },
    {
      id: "categories",
      label: "Categorias",
      value: categories ? String(categoryCounts.total) : "…",
      hint: categories
        ? `${categoryCounts.active} ativas · ${categoryCounts.inactive} inativas`
        : "Carregando…",
    },
    {
      id: "products",
      label: "Produtos ativos",
      value:
        productsCount != null ? `${productsCount}${productsHasMore ? "+" : ""}` : "…",
      hint: "Na vitrine pública",
    },
  ];

  if (isLoading && !sellers && !categories && productsCount == null) {
    return <div className={sharedStyles.skeleton} aria-busy="true" />;
  }

  return (
    <div className={sharedStyles.stack}>
      <FadeIn>
        <AdminPageHeader
          title="Painel do Marketplace"
          description="Indicadores reais de vendedores, categorias e produtos ativos"
          icon={
            <ChartNoAxesCombined size={18} strokeWidth={1.75} aria-hidden="true" />
          }
        />
      </FadeIn>

      {error ? (
        <AdminEmptyState title="Não foi possível carregar tudo" description={error} />
      ) : null}

      <StaggerContainer className={sharedStyles.metrics}>
        {metrics.map((metric) => (
          <StaggerItem key={metric.id}>
            <AdminMetricCard
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
              icon={METRIC_ICONS[metric.id]}
            />
          </StaggerItem>
        ))}
      </StaggerContainer>

      <section className={adminStyles.tablesRow}>
        <div className={adminStyles.panel}>
          <div className={adminStyles.panelHead}>
            <h2 className={adminStyles.panelTitle}>Vendedores recentes</h2>
            <Link href="/admin/vendedores" className={sharedStyles.linkBtn}>
              Ver todos
            </Link>
          </div>
          <div className={adminStyles.tableScroll}>
            {recentSellers.length === 0 ? (
              <AdminEmptyState title="Nenhum vendedor cadastrado ainda" />
            ) : (
              <table className={adminStyles.table}>
                <thead>
                  <tr>
                    <th>Loja</th>
                    <th>Status</th>
                    <th>Comissão</th>
                    <th>Cadastrado em</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSellers.map((seller) => (
                    <tr key={seller.id}>
                      <td>{seller.tradeName}</td>
                      <td>
                        <AdminStatusBadge
                          label={ADMIN_SELLER_STATUS_LABEL[seller.status]}
                          tone={sellerTone(seller.status)}
                        />
                      </td>
                      <td>{formatCommission(seller.commissionBps)}</td>
                      <td>{formatDate(seller.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className={adminStyles.panel}>
          <div className={adminStyles.panelHead}>
            <h2 className={adminStyles.panelTitle}>Aprovações pendentes</h2>
            <Link href="/admin/vendedores" className={sharedStyles.linkBtn}>
              Ver todos
            </Link>
          </div>
          {pendingSellers.length === 0 ? (
            <AdminEmptyState title="Nenhuma aprovação pendente" />
          ) : (
            <div className={adminStyles.approvalList}>
              {pendingSellers.slice(0, 6).map((seller) => (
                <article key={seller.id} className={adminStyles.approvalItem}>
                  <h3 className={adminStyles.approvalTitle}>
                    <Link href="/admin/vendedores" className={sharedStyles.linkBtn}>
                      {seller.tradeName}
                    </Link>
                  </h3>
                  <p className={adminStyles.approvalDesc}>
                    {seller.email} · cadastrado em {formatDate(seller.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
