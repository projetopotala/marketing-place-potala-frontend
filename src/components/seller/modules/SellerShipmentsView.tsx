"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  confirmMySellerOrder,
  deliverMySellerOrder,
  listMySellerOrders,
  prepareMySellerOrder,
  shipMySellerOrder,
  SELLER_ORDER_STATUS_LABEL,
  type SellerOrderForSellerResponse,
  type SellerOrderStatus,
} from "@/lib/api/orders";
import { ApiError } from "@/lib/api/client";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";
import styles from "@/components/seller/seller.module.css";

const PAGE_SIZE = 8;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

type NextAction = {
  label: string;
  run: (id: string) => Promise<SellerOrderForSellerResponse>;
};

// Um passo por vez, nunca um status arbitrário — mesma trava que o
// backend já aplica (409 fora de ordem). DELIVERED/CANCELLED são
// terminais nesta v1, sem ação nenhuma.
const NEXT_ACTION: Partial<Record<SellerOrderStatus, NextAction>> = {
  PENDING: { label: "Confirmar", run: confirmMySellerOrder },
  CONFIRMED: { label: "Iniciar preparo", run: prepareMySellerOrder },
  PREPARING: { label: "Marcar como enviado", run: shipMySellerOrder },
  SHIPPED: { label: "Marcar como entregue", run: deliverMySellerOrder },
};

/**
 * Lista real via GET /seller/orders (mesmo endpoint de SellerOrdersView) —
 * substitui o mock antigo (AdminDataContext, model Shipment fictício com
 * transportadora/rastreio/ETA que nunca existiu no backend). Escopo
 * confirmado com o Arthur (28/09): só avançar o status de fulfillment já
 * real no SellerOrder (PENDING -> CONFIRMED -> PREPARING -> SHIPPED ->
 * DELIVERED) — sem transportadora nem código de rastreio, esses campos não
 * existem no schema (ver status-migracao-microservicos.md).
 */
export function SellerShipmentsView() {
  const toast = useAdminToast();
  const [orders, setOrders] = useState<SellerOrderForSellerResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Pilha de cursors já vistos, pra permitir "anterior" com uma API que só
  // oferece nextCursor (cursor-pagination é, por natureza, só pra frente).
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const loadPage = useCallback(async (cursor: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await listMySellerOrders({ limit: PAGE_SIZE, cursor });
      setOrders(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setOrders(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as entregas.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(cursorStack[pageIndex] ?? null);
    // Só a página atual dispara recarga — cursorStack cresce por goNext, não deve reexecutar sozinho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, loadPage]);

  function goNext() {
    if (!hasNextPage || !orders || orders.length === 0) return;
    const nextCursor = orders[orders.length - 1]?.id ?? null;
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

  async function advance(sellerOrder: SellerOrderForSellerResponse) {
    const action = NEXT_ACTION[sellerOrder.status];
    if (!action) return;

    setAdvancingId(sellerOrder.id);
    setRowErrors((current) => {
      const next = { ...current };
      delete next[sellerOrder.id];
      return next;
    });

    try {
      const updated = await action.run(sellerOrder.id);
      setOrders((current) =>
        (current ?? []).map((row) => (row.id === updated.id ? updated : row)),
      );
      toast.push("Entrega atualizada.");
    } catch (err) {
      setRowErrors((current) => ({
        ...current,
        [sellerOrder.id]:
          err instanceof ApiError
            ? err.message
            : "Não foi possível atualizar a entrega.",
      }));
    } finally {
      setAdvancingId(null);
    }
  }

  return (
    <>
      <header>
        <h1 className={styles.pageTitle}>Entregas</h1>
        <p className={styles.pageLead}>
          Acompanhe o fulfillment dos pedidos da sua loja e avance o status
          conforme for preparando e enviando cada um.
        </p>
      </header>

      <section className={styles.panel}>
        {isLoading ? (
          <p role="status">Carregando entregas…</p>
        ) : error ? (
          <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
            {error}
          </p>
        ) : !orders || orders.length === 0 ? (
          <p>Nenhum pedido encontrado.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
            {orders.map((sellerOrder) => {
              const action = NEXT_ACTION[sellerOrder.status];
              return (
                <li key={sellerOrder.id} className={styles.metricCard}>
                  <p className={styles.metricLabel}>
                    <Link
                      href={`/loja/pedidos/${sellerOrder.id}`}
                      className={styles.rowLink}
                    >
                      Pedido {sellerOrder.order.orderNumber}
                    </Link>
                    {" · "}
                    {SELLER_ORDER_STATUS_LABEL[sellerOrder.status]}
                  </p>
                  <p>
                    {sellerOrder.order.shippingAddress
                      ? `${sellerOrder.order.shippingAddress.city}/${sellerOrder.order.shippingAddress.state}`
                      : "Endereço indisponível"}
                    {" · "}
                    {formatDate(sellerOrder.createdAt)}
                  </p>
                  {rowErrors[sellerOrder.id] ? (
                    <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
                      {rowErrors[sellerOrder.id]}
                    </p>
                  ) : null}
                  {action ? (
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      disabled={advancingId === sellerOrder.id}
                      onClick={() => void advance(sellerOrder)}
                    >
                      {advancingId === sellerOrder.id ? "Atualizando…" : action.label}
                    </button>
                  ) : (
                    <p>
                      {sellerOrder.status === "DELIVERED"
                        ? "Entrega concluída."
                        : "Sem ação disponível para este pedido."}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={pageIndex === 0 || isLoading}
            onClick={goPrevious}
          >
            Anterior
          </button>
          <span>Página {pageIndex + 1}</span>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={!hasNextPage || isLoading}
            onClick={goNext}
          >
            Próxima
          </button>
        </div>
      </section>
    </>
  );
}
