"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AccountChrome } from "@/components/account/AccountChrome";
import {
  listMyOrders,
  ORDER_STATUS_LABEL,
  type OrderResponse,
} from "@/lib/api/orders";
import { ApiError } from "@/lib/api/client";
import { formatPrice } from "@/data/marketplace";

const PAGE_SIZE = 10;

/**
 * GET /orders (lista) inclui `sellerOrders` mas SEM `items` (orders.
 * service.ts, `listForCustomer`: `include: { sellerOrders: true }`, sem
 * `items: true` -- diferente de GET /orders/:id, que inclui tudo). Bug
 * real encontrado nesta sessão: essa funcao assumia `items` sempre
 * presente e quebrava a pagina inteira (`Cannot read properties of
 * undefined (reading 'length')`) toda vez que alguem abria Meus
 * Pedidos. Guarda contra `items` ausente em vez de presumir o shape do
 * detalhe.
 */
function itemCount(order: OrderResponse): number {
  return order.sellerOrders.reduce(
    (total, sellerOrder) => total + (sellerOrder.items?.length ?? 0),
    0,
  );
}

/**
 * Lista real via GET /orders (orders-service, através do gateway) —
 * substitui o histórico demonstrativo em localStorage (AccountDataContext)
 * que nunca refletia pedidos reais (esse dado mock continua sendo escrito
 * em paralelo pelo checkout, best-effort, mas não é mais a fonte desta
 * tela — ver status do projeto).
 *
 * Mesmo padrão de paginação por cursor de SellerProductsView: sem busca por
 * código nem filtro por status aqui — o backend só pagina por cursor
 * (PaginationQueryDto: limit/cursor), não tem parâmetro de busca/filtro; a
 * tela mock antiga tinha os dois, mas filtrando um array já carregado
 * inteiro no cliente, o que a API real não oferece.
 */
export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<OrderResponse[] | null>(null);
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
      const page = await listMyOrders({ limit: PAGE_SIZE, cursor });
      setOrders(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setOrders(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar seus pedidos.",
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
    <AccountChrome
      title="Meus pedidos"
      lead="Pedidos reais da sua conta, direto do orders-service."
      breadcrumbCurrent="Pedidos"
    >
      {isLoading ? (
        <p role="status">Carregando pedidos…</p>
      ) : error ? (
        <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
          {error}
        </p>
      ) : !orders || orders.length === 0 ? (
        <p>Nenhum pedido encontrado.</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Código</th>
                  <th align="left">Status</th>
                  <th align="left">Itens</th>
                  <th align="left">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/minha-conta/pedidos/${order.id}`}>
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td>{ORDER_STATUS_LABEL[order.status]}</td>
                    <td>{itemCount(order)}</td>
                    <td>{formatPrice(order.totalCents / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul
            className="md:hidden"
            style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}
          >
            {orders.map((order) => (
              <li
                key={order.id}
                style={{
                  border: "1px solid var(--potala-border)",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <Link href={`/minha-conta/pedidos/${order.id}`}>
                  {order.orderNumber}
                </Link>
                <p>{ORDER_STATUS_LABEL[order.status]}</p>
                <p>{formatPrice(order.totalCents / 100)}</p>
              </li>
            ))}
          </ul>

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
              disabled={pageIndex === 0 || isLoading}
              onClick={goPrevious}
            >
              Anterior
            </button>
            <span>Página {pageIndex + 1}</span>
            <button
              type="button"
              disabled={!hasNextPage || isLoading}
              onClick={goNext}
            >
              Próxima
            </button>
          </div>
        </>
      )}
    </AccountChrome>
  );
}
