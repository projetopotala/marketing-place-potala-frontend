"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AccountChrome } from "@/components/account/AccountChrome";
import { ApiError } from "@/lib/api/client";
import {
  RETURN_STATUS_LABEL,
  listMyReturns,
  type ReturnListItemResponse,
} from "@/lib/api/returns";

const PAGE_SIZE = 10;

/**
 * Real via GET /orders/returns (orders-service, através do gateway) --
 * substitui o mock antigo (`useAccountData`, `db.returns`, `createReturn`
 * em localStorage). Diferente da tela antiga, esta página agora é só
 * leitura -- solicitar uma devolução acontece no detalhe do pedido
 * (`/minha-conta/pedidos/[id]`, `OrderItemReturnForm`), mesmo lugar onde
 * já vive o formulário de avaliação, porque a elegibilidade (SellerOrder
 * CONFIRMED) e a identidade do item só existem naquela tela -- juntar tudo
 * aqui de novo exigiria refazer a mesma busca de pedidos elegíveis, sem
 * ganho real.
 */
export default function AccountReturnsPage() {
  const [returns, setReturns] = useState<ReturnListItemResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  const loadPage = useCallback(async (cursor: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await listMyReturns({ limit: PAGE_SIZE, cursor });
      setReturns(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setReturns(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar suas devoluções.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(cursorStack[pageIndex] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, loadPage]);

  function goNext() {
    if (!hasNextPage || !returns || returns.length === 0) return;
    const nextCursor = returns[returns.length - 1]?.id ?? null;
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
      title="Devoluções"
      lead="Solicite uma devolução no detalhe de um pedido confirmado. Aqui ficam suas solicitações."
      breadcrumbCurrent="Devoluções"
    >
      <p>
        Para solicitar uma devolução, acesse{" "}
        <Link href="/minha-conta/pedidos">Meus Pedidos</Link> e abra o
        pedido desejado -- o formulário aparece nos itens já confirmados
        pelo vendedor.
      </p>

      <section style={{ marginTop: 24 }}>
        <h2>Solicitações</h2>
        {isLoading ? (
          <p role="status">Carregando…</p>
        ) : error ? (
          <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
            {error}
          </p>
        ) : !returns || returns.length === 0 ? (
          <p>Nenhuma devolução solicitada ainda.</p>
        ) : (
          <ul>
            {returns.map((item) => (
              <li key={item.id} style={{ marginBottom: 8 }}>
                Pedido {item.orderItem.sellerOrder.order.orderNumber} ·{" "}
                {item.orderItem.productTitle} ·{" "}
                {RETURN_STATUS_LABEL[item.status]} · {item.reason}
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
          <button type="button" disabled={pageIndex === 0 || isLoading} onClick={goPrevious}>
            Anterior
          </button>
          <span>Página {pageIndex + 1}</span>
          <button type="button" disabled={!hasNextPage || isLoading} onClick={goNext}>
            Próxima
          </button>
        </div>
      </section>
    </AccountChrome>
  );
}
