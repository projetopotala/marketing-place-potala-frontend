"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSellerRatingSummary,
  listMySellerReviews,
  type RatingSummaryResponse,
  type ReviewResponse,
} from "@/lib/api/reviews";
import { ApiError } from "@/lib/api/client";
import { useSellerId } from "@/features/seller/useSellerId";
import styles from "@/components/seller/seller.module.css";

/**
 * Real via GET /seller/reviews + GET /public/reviews/sellers/:id/rating-
 * summary (orders-service, Fase B). Substitui o mock antigo
 * (`useAdminData`, produtos ativos como "base de reputação", sem
 * avaliação real nenhuma).
 *
 * `getSellerRatingSummary` já existia no client (`lib/api/reviews.ts`,
 * escrito na Fase B, sem consumidor até agora — a nota da própria loja
 * pra `/vendedor/[slug]` continua fora de escopo, ver nota na Fase B do
 * status doc). `listMySellerReviews` é novo, contra o endpoint
 * `GET /seller/reviews` criado nesta sessão.
 *
 * Sem nome do produto na tabela: `Review` só guarda `productId` (snapshot,
 * sem FK cross-schema) — resolver o título exigiria uma chamada por linha
 * a catalog-service, fora do escopo desta rodada. Mostra nota e
 * comentário, que é o que existe sem custo extra.
 */

const PAGE_SIZE = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function stars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

export function SellerReviewsView() {
  const sellerId = useSellerId();

  const [summary, setSummary] = useState<RatingSummaryResponse | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);

  const [reviews, setReviews] = useState<ReviewResponse[] | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  useEffect(() => {
    if (!sellerId) return;
    let cancelled = false;
    // getSellerRatingSummary já degrada pra { average: 0, count: 0 } em
    // qualquer falha (ver reviews.ts) — não rejeita, então não precisa de
    // try/catch aqui.
    getSellerRatingSummary(sellerId)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .finally(() => {
        if (!cancelled) setIsSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  const loadPage = useCallback(async (cursor: string | null) => {
    setIsTableLoading(true);
    setTableError(null);
    try {
      const page = await listMySellerReviews({ limit: PAGE_SIZE, cursor });
      setReviews(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setReviews(null);
      setTableError(
        err instanceof ApiError ? err.message : "Não foi possível carregar as avaliações.",
      );
    } finally {
      setIsTableLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sellerId) return;
    void loadPage(cursorStack[pageIndex] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId, pageIndex, loadPage]);

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

  if (!sellerId) {
    return <p role="status">Carregando avaliações…</p>;
  }

  return (
    <>
      <header>
        <h1 className={styles.pageTitle}>Avaliações</h1>
        <p className={styles.pageLead}>
          Nota e comentários deixados por clientes que compraram na sua loja.
        </p>
      </header>

      {isSummaryLoading || !summary ? (
        <p role="status" aria-live="polite">
          Carregando nota da loja…
        </p>
      ) : (
        <section className={styles.metrics} aria-label="Nota da loja">
          <article className={styles.metricCard}>
            <p className={styles.metricLabel}>Nota da loja</p>
            <p className={styles.metricValue}>{summary.average.toFixed(1)}</p>
          </article>
          <article className={styles.metricCard}>
            <p className={styles.metricLabel}>Total de avaliações</p>
            <p className={styles.metricValue}>{summary.count}</p>
          </article>
        </section>
      )}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Avaliações recebidas</h2>
        {isTableLoading ? (
          <p role="status">Carregando avaliações…</p>
        ) : tableError ? (
          <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
            {tableError}
          </p>
        ) : !reviews || reviews.length === 0 ? (
          <p>Nenhuma avaliação recebida ainda.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nota</th>
                  <th>Comentário</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review.id}>
                    <td aria-label={`${review.rating} de 5`}>{stars(review.rating)}</td>
                    <td>{review.comment ?? "—"}</td>
                    <td>{formatDate(review.createdAt)}</td>
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
            disabled={!hasNextPage || isTableLoading}
            onClick={goNext}
          >
            Próxima
          </button>
        </div>
      </section>
    </>
  );
}
