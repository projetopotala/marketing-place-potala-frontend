"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  listMySellerOrders,
  SELLER_ORDER_STATUS_LABEL,
  type SellerOrderForSellerResponse,
} from "@/lib/api/orders";
import { ApiError } from "@/lib/api/client";
import styles from "@/components/seller/seller.module.css";

const PAGE_SIZE = 8;

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Lista real via GET /seller/orders (orders-service, através do gateway) —
 * substitui o mock antigo baseado em AdminDataContext (ver
 * status-migracao-microservicos.md, "Fase 3 — pedidos do vendedor").
 *
 * Somente leitura nesta v1: sem busca por texto, sem filtro por status (o
 * backend só pagina por cursor) e sem ações de avançar status/registrar
 * rastreio — a versão mock tinha as duas coisas, deliberadamente deixadas de
 * fora aqui (ver comentário em SellerOrderDetailView.tsx e o status doc).
 */
export function SellerOrdersView() {
  const [orders, setOrders] = useState<SellerOrderForSellerResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Pilha de cursors já vistos, pra permitir "anterior" com uma API que só
  // oferece nextCursor (cursor-pagination é, por natureza, só pra frente).
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
          : "Não foi possível carregar os pedidos.",
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

  return (
    <>
      <header>
        <h1 className={styles.pageTitle}>Pedidos</h1>
        <p className={styles.pageLead}>
          Pedidos recebidos pela sua loja, direto do orders-service.
        </p>
      </header>

      <section className={styles.panel}>
        {isLoading ? (
          <p role="status">Carregando pedidos…</p>
        ) : error ? (
          <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
            {error}
          </p>
        ) : !orders || orders.length === 0 ? (
          <p>Nenhum pedido encontrado.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Data</th>
                  <th>Cidade</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((sellerOrder) => (
                  <tr key={sellerOrder.id}>
                    <td>
                      <Link
                        href={`/loja/pedidos/${sellerOrder.id}`}
                        className={styles.rowLink}
                      >
                        {sellerOrder.order.orderNumber}
                      </Link>
                    </td>
                    <td>
                      <span className={styles.badge}>
                        {SELLER_ORDER_STATUS_LABEL[sellerOrder.status]}
                      </span>
                    </td>
                    <td>{formatMoney(sellerOrder.subtotalCents)}</td>
                    <td>{formatDate(sellerOrder.createdAt)}</td>
                    <td>
                      {sellerOrder.order.shippingAddress
                        ? `${sellerOrder.order.shippingAddress.city}/${sellerOrder.order.shippingAddress.state}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
