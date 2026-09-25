"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api/client";
import {
  listMySellerOrders,
  ORDER_STATUS_LABEL,
  type OrderStatus,
  type SellerOrderForSellerResponse,
} from "@/lib/api/orders";
import styles from "@/components/seller/seller.module.css";

/**
 * Real financeiro, via GET /seller/orders (orders-service, através do
 * gateway) — substitui o mock antigo baseado em AdminDataContext
 * (selectSellerTransactions/selectSellerPayouts, ambos com dados
 * inventados). Ver status-migracao-microservicos.md, "Financeiro do
 * vendedor".
 *
 * Removidos de propósito, mesmo raciocínio já aplicado ao "Total líquido"
 * do Painel (SellerDashboardView): comissão, taxas, líquido e repasses.
 * `SellerOrder.commissionCents`/`sellerNetCents` são sempre 0 nesta v1 do
 * orders-service (comissão por vendedor ainda não é calculada — ver
 * OrdersService.createOrderRecords) e não existe model de repasse/payout em
 * nenhum backend real. Mostrar esses números pareceria um cálculo real e
 * não é — decisão do Arthur em 24/09.
 *
 * A distinção com /loja/pedidos: aquela tela usa `SellerOrder.status`
 * (rastreio/fulfillment: preparando, enviado, entregue...); esta usa
 * `Order.status`, o status de PAGAMENTO do pedido todo (aguardando
 * pagamento, pago, cancelado...) — o que de fato importa pra uma leitura
 * financeira, e um dado que a tela de pedidos não mostra hoje.
 */

const SUMMARY_LIMIT = 100;
const TABLE_PAGE_SIZE = 8;

/** Estados em que o pagamento já foi aprovado pelo gateway (mock nesta v1). */
const PAID_STATUSES: OrderStatus[] = ["PAID", "FULFILLING", "COMPLETED"];

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
  hasMore: boolean;
}

function buildSummary(orders: SellerOrderForSellerResponse[], hasMore: boolean): Summary {
  const summary: Summary = {
    paidCents: 0,
    paidCount: 0,
    pendingCents: 0,
    pendingCount: 0,
    cancelledCents: 0,
    cancelledCount: 0,
    hasMore,
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

export function SellerFinanceView() {
  // Resumo: uma leitura só, sobre até SUMMARY_LIMIT pedidos mais recentes
  // (mesma aproximação do Painel — o backend só pagina por cursor, sem
  // endpoint de agregação em nenhum serviço deste projeto).
  const [summaryOrders, setSummaryOrders] = useState<SellerOrderForSellerResponse[] | null>(null);
  const [summaryHasMore, setSummaryHasMore] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);

  // Tabela: paginada por cursor, mesmo padrão de SellerOrdersView.
  const [tableOrders, setTableOrders] = useState<SellerOrderForSellerResponse[] | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [tableHasNextPage, setTableHasNextPage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSummary() {
      setIsSummaryLoading(true);
      setSummaryError(null);
      try {
        const page = await listMySellerOrders({ limit: SUMMARY_LIMIT });
        if (cancelled) return;
        setSummaryOrders(page.items);
        setSummaryHasMore(page.pageInfo.hasNextPage);
      } catch (err) {
        if (cancelled) return;
        setSummaryOrders(null);
        setSummaryError(
          err instanceof ApiError ? err.message : "Não foi possível carregar o resumo financeiro.",
        );
      } finally {
        if (!cancelled) setIsSummaryLoading(false);
      }
    }
    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTablePage = useCallback(async (cursor: string | null) => {
    setIsTableLoading(true);
    setTableError(null);
    try {
      const page = await listMySellerOrders({ limit: TABLE_PAGE_SIZE, cursor });
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

  const summary = useMemo(() => {
    if (!summaryOrders) return null;
    return buildSummary(summaryOrders, summaryHasMore);
  }, [summaryOrders, summaryHasMore]);

  return (
    <>
      <header>
        <h1 className={styles.pageTitle}>Financeiro</h1>
        <p className={styles.pageLead}>
          Faturamento por status de pagamento, calculado a partir dos seus
          pedidos reais (até os {SUMMARY_LIMIT} mais recentes).
        </p>
      </header>

      {isSummaryLoading ? (
        <p role="status" aria-live="polite">
          Carregando resumo…
        </p>
      ) : summaryError || !summary ? (
        <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
          {summaryError ?? "Não foi possível carregar o resumo financeiro."}
        </p>
      ) : (
        <section className={styles.metrics} aria-label="Totais por status de pagamento">
          <article className={styles.metricCard}>
            <p className={styles.metricLabel}>Pago</p>
            <p className={styles.metricValue}>{formatMoney(summary.paidCents)}</p>
            <p className={styles.metricLabel}>{summary.paidCount} pedido(s)</p>
          </article>
          <article className={styles.metricCard}>
            <p className={styles.metricLabel}>Aguardando pagamento</p>
            <p className={styles.metricValue}>{formatMoney(summary.pendingCents)}</p>
            <p className={styles.metricLabel}>{summary.pendingCount} pedido(s)</p>
          </article>
          <article className={styles.metricCard}>
            <p className={styles.metricLabel}>Cancelado</p>
            <p className={styles.metricValue}>{formatMoney(summary.cancelledCents)}</p>
            <p className={styles.metricLabel}>{summary.cancelledCount} pedido(s)</p>
          </article>
        </section>
      )}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Transações</h2>
        {isTableLoading ? (
          <p role="status">Carregando transações…</p>
        ) : tableError ? (
          <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
            {tableError}
          </p>
        ) : !tableOrders || tableOrders.length === 0 ? (
          <p>Nenhuma transação encontrada.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Data</th>
                  <th>Status do pagamento</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {tableOrders.map((sellerOrder) => (
                  <tr key={sellerOrder.id}>
                    <td>
                      <Link href={`/loja/pedidos/${sellerOrder.id}`} className={styles.rowLink}>
                        {sellerOrder.order.orderNumber}
                      </Link>
                    </td>
                    <td>{formatDate(sellerOrder.createdAt)}</td>
                    <td>
                      <span className={styles.badge}>
                        {ORDER_STATUS_LABEL[sellerOrder.order.status]}
                      </span>
                    </td>
                    <td>{formatMoney(sellerOrder.subtotalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={pageIndex === 0 || isTableLoading}
            onClick={goPrevious}
          >
            Anterior
          </button>
          <span>Página {pageIndex + 1}</span>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={!tableHasNextPage || isTableLoading}
            onClick={goNext}
          >
            Próxima
          </button>
        </div>
      </section>
    </>
  );
}
