"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AccountChrome } from "@/components/account/AccountChrome";
import { ApiError } from "@/lib/api/client";
import { listMyReviews, type ReviewResponse } from "@/lib/api/reviews";

const PAGE_SIZE = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function stars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

/**
 * Real via GET /orders/reviews (orders-service, novo nesta sessão) --
 * substitui o mock antigo (`useAccountData`, `db.reviews`, `submitReview`
 * em localStorage, com seções "Pendentes"/"Publicadas" e edição de
 * avaliação já publicada).
 *
 * Escopo confirmado com o Arthur: só lista de avaliações já enviadas,
 * somente leitura, mesmo padrão de SellerReviewsView.tsx (painel do
 * vendedor). Duas funções do mock saem, sem equivalente real: "editar
 * avaliação publicada" (não existe endpoint de edição de Review -- só
 * criação) e a seção "Pendentes" com formulário inline (avaliar um pedido
 * novo já acontece no detalhe do pedido, `/minha-conta/pedidos/[id]`,
 * `OrderItemReviewForm`, construído na Fase B -- juntar tudo aqui de novo
 * duplicaria a mesma busca de itens elegíveis sem ganho real, mesmo
 * raciocínio já usado em `/minha-conta/devolucoes`).
 *
 * Sem nome do produto na tabela, mesma limitação documentada em
 * SellerReviewsView.tsx: Review só guarda productId (snapshot, sem FK
 * cross-schema), resolver o título exigiria uma chamada por linha a
 * catalog-service.
 */
export default function AccountReviewsPage() {
  const [reviews, setReviews] = useState<ReviewResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  const loadPage = useCallback(async (cursor: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await listMyReviews({ limit: PAGE_SIZE, cursor });
      setReviews(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setReviews(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar suas avaliações.",
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
    if (!hasNextPage || !reviews || reviews.length === 0) return;
    const nextCursor = reviews[reviews.length - 1]?.id ?? null;
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
      title="Avaliações"
      lead="Avaliações que você já enviou."
      breadcrumbCurrent="Avaliações"
    >
      <p>
        Para avaliar um pedido, acesse{" "}
        <Link href="/minha-conta/pedidos">Meus Pedidos</Link> e abra o
        pedido desejado -- o formulário aparece nos itens já entregues.
      </p>

      <section style={{ marginTop: 24 }}>
        <h2>Enviadas</h2>
        {isLoading ? (
          <p role="status">Carregando…</p>
        ) : error ? (
          <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
            {error}
          </p>
        ) : !reviews || reviews.length === 0 ? (
          <p>Nenhuma avaliação enviada ainda.</p>
        ) : (
          <ul>
            {reviews.map((review) => (
              <li key={review.id} style={{ marginBottom: 8 }}>
                <span aria-label={`${review.rating} de 5`}>{stars(review.rating)}</span>
                {" · "}
                {review.comment ?? "Sem comentário"}
                {" · "}
                {formatDate(review.createdAt)}
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
