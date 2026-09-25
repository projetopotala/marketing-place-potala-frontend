"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, WalletCards, XCircle } from "lucide-react";
import {
  listAdminOrders,
  listAdminSellers,
  type AdminSeller,
  type AdminSellerOrder,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/api/orders";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminMetricCard, AdminMetricsRow } from "@/components/admin/shared/AdminMetricCard";
import { AdminDataTable, sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminStatusBadge, AdminEmptyState } from "@/components/admin/shared/AdminStatusBadge";

/**
 * Real financeiro admin, via GET /admin/orders (orders-service, novo este
 * sprint — ver status-migracao-microservicos.md, "Financeiro do
 * vendedor"/admin). Substitui o mock antigo baseado em AdminDataContext
 * (db.transactions, todo dado inventado: forma de pagamento, ranking de
 * vendedor por líquido, série de receita).
 *
 * Removidos de propósito, mesmo raciocínio já aplicado em
 * SellerFinanceView.tsx: comissão, taxas, líquido e repasses — sempre 0 ou
 * inexistentes em qualquer backend real desta v1. Também removidos:
 * breakdown por forma de pagamento (o único provider gravado hoje é
 * "mock" — MockPaymentGatewayAdapter, ver schema.prisma de orders-service)
 * e ranking de vendedor por líquido (líquido é sempre 0). Decisão do
 * Arthur em 24/09.
 *
 * `AdminSellerOrder` não traz nome de loja (sem FK cross-schema pro join
 * no backend) — resolvido aqui client-side com um segundo fetch a
 * GET /admin/sellers, mesmo padrão de mapa id->nome já usado em outros
 * pontos do admin panel.
 */

const SUMMARY_LIMIT = 100;
const TABLE_PAGE_SIZE = 10;

const PAID_STATUSES: OrderStatus[] = ["PAID", "FULFILLING", "COMPLETED"];

function orderStatusTone(status: OrderStatus) {
  if (status === "PAID" || status === "COMPLETED") return "success" as const;
  if (status === "FULFILLING") return "muted" as const;
  if (status === "PENDING_PAYMENT") return "warning" as const;
  return "danger" as const;
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

interface Summary {
  paidCents: number;
  paidCount: number;
  pendingCents: number;
  pendingCount: number;
  cancelledCents: number;
  cancelledCount: number;
}

function buildSummary(orders: AdminSellerOrder[]): Summary {
  const summary: Summary = {
    paidCents: 0,
    paidCount: 0,
    pendingCents: 0,
    pendingCount: 0,
    cancelledCents: 0,
    cancelledCount: 0,
  };

  for (const sellerOrder of orders) {
    const status = sellerOrder.order.status;
    if (PAID_STATUSES.includes(status)) {
      summary.paidCents += sellerOrder.subtotalCents;
      summary.paidCount += 1;
    } else if (status === "PENDING_PAYMENT") {
      summary.pendingCents += sellerOrder.subtotalCents;
      summary.pendingCount += 1;
    } else if (status === "CANCELLED") {
      summary.cancelledCents += sellerOrder.subtotalCents;
      summary.cancelledCount += 1;
    }
  }

  return summary;
}

export function FinanceView() {
  // Resumo + mapa de nomes de loja: uma leitura só, sobre até
  // SUMMARY_LIMIT pedidos/vendedores mais recentes (backend só pagina por
  // cursor, sem endpoint de agregação em nenhum serviço deste projeto —
  // mesma aproximação do Painel do vendedor e do dashboard admin).
  const [summaryOrders, setSummaryOrders] = useState<AdminSellerOrder[] | null>(null);
  const [sellers, setSellers] = useState<AdminSeller[] | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);

  // Tabela: paginada por cursor, mesmo padrão de SellersView/SellerFinanceView.
  const [tableOrders, setTableOrders] = useState<AdminSellerOrder[] | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [tableHasNextPage, setTableHasNextPage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listAdminOrders({ limit: SUMMARY_LIMIT }),
      listAdminSellers({ limit: SUMMARY_LIMIT }),
    ])
      .then(([ordersPage, sellersPage]) => {
        if (cancelled) return;
        setSummaryOrders(ordersPage.items);
        setSellers(sellersPage.items);
      })
      .catch((err) => {
        if (cancelled) return;
        setSummaryOrders(null);
        setSummaryError(
          err instanceof ApiError ? err.message : "Não foi possível carregar o resumo financeiro.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTablePage = useCallback(async (cursor: string | null) => {
    setIsTableLoading(true);
    setTableError(null);
    try {
      const page = await listAdminOrders({ limit: TABLE_PAGE_SIZE, cursor });
      setTableOrders(page.items);
      setTableHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setTableOrders(null);
      setTableError(
        err instanceof ApiError ? err.message : "Não foi possível carregar as transações.",
      );
    } finally {
      setIsTableLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTablePage(cursorStack[pageIndex] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, loadTablePage]);

  function goNext() {
    if (!tableHasNextPage || !tableOrders || tableOrders.length === 0) return;
    const nextCursor = tableOrders[tableOrders.length - 1]?.id ?? null;
    setCursorStack((stack) => {
      const next = stack.slice(0, pageIndex + 1);
      next.push(nextCursor);
      return next;
    });
    setPageIndex((index) => index + 1);
  }

  function goPrevious() {
    if (pageIndex === 0) return;
    setPageIndex((index) => index - 1);
  }

  const sellerName = useMemo(() => {
    const map = new Map((sellers ?? []).map((s) => [s.id, s.tradeName]));
    return (id: string) => map.get(id) ?? id;
  }, [sellers]);

  const summary = useMemo(() => {
    if (!summaryOrders) return null;
    return buildSummary(summaryOrders);
  }, [summaryOrders]);

  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader
        title="Financeiro"
        description={`Faturamento por status de pagamento em toda a plataforma, calculado a partir dos pedidos reais (até os ${SUMMARY_LIMIT} mais recentes).`}
      />

      {isSummaryLoading ? (
        <p role="status" aria-live="polite">
          Carregando resumo…
        </p>
      ) : summaryError || !summary ? (
        <AdminEmptyState
          title="Não foi possível carregar o resumo"
          description={summaryError ?? undefined}
        />
      ) : (
        <AdminMetricsRow>
          <AdminMetricCard
            label="Pago"
            value={formatMoney(summary.paidCents)}
            hint={`${summary.paidCount} pedido(s)`}
            icon={WalletCards}
          />
          <AdminMetricCard
            label="Aguardando pagamento"
            value={formatMoney(summary.pendingCents)}
            hint={`${summary.pendingCount} pedido(s)`}
            icon={Clock}
          />
          <AdminMetricCard
            label="Cancelado"
            value={formatMoney(summary.cancelledCents)}
            hint={`${summary.cancelledCount} pedido(s)`}
            icon={XCircle}
          />
        </AdminMetricsRow>
      )}

      {isTableLoading ? (
        <p role="status">Carregando transações…</p>
      ) : tableError ? (
        <AdminEmptyState title="Não foi possível carregar as transações" description={tableError} />
      ) : (
        <AdminDataTable
          caption="Transações de todas as lojas"
          rows={tableOrders ?? []}
          columns={[
            { key: "order", header: "Pedido", render: (row) => row.order.orderNumber },
            { key: "seller", header: "Loja", render: (row) => sellerName(row.sellerId) },
            { key: "date", header: "Data", render: (row) => formatDate(row.createdAt) },
            {
              key: "status",
              header: "Status do pagamento",
              render: (row) => (
                <AdminStatusBadge
                  label={ORDER_STATUS_LABEL[row.order.status]}
                  tone={orderStatusTone(row.order.status)}
                />
              ),
            },
            { key: "value", header: "Valor", render: (row) => formatMoney(row.subtotalCents) },
          ]}
          mobileCard={(row) => (
            <>
              <strong>{row.order.orderNumber}</strong>
              <span>{sellerName(row.sellerId)}</span>
              <AdminStatusBadge
                label={ORDER_STATUS_LABEL[row.order.status]}
                tone={orderStatusTone(row.order.status)}
              />
              <span>
                {formatMoney(row.subtotalCents)} · {formatDate(row.createdAt)}
              </span>
            </>
          )}
        />
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
        <button
          type="button"
          className={sharedStyles.btnGhost}
          disabled={pageIndex === 0 || isTableLoading}
          onClick={goPrevious}
        >
          Anterior
        </button>
        <span>Página {pageIndex + 1}</span>
        <button
          type="button"
          className={sharedStyles.btnGhost}
          disabled={!tableHasNextPage || isTableLoading}
          onClick={goNext}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
