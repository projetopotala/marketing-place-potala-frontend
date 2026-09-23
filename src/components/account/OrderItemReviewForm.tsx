"use client";

import { useState, type FormEvent } from "react";
import { createReview, type ReviewResponse } from "@/lib/api/reviews";
import { ApiError } from "@/lib/api/client";

interface OrderItemReviewFormProps {
  orderId: string;
  itemId: string;
  onSubmitted: (review: ReviewResponse) => void;
}

/**
 * Fase B do roadmap "estilo Mercado Livre" (ver roadmap-mercado-livre.md
 * no Claude Project). A página de detalhe do pedido decide QUANDO mostrar
 * isto (item de um SellerOrder CONFIRMED ainda sem Review) — este
 * componente só cuida do formulário em si e devolve a avaliação criada
 * pro chamador atualizar o estado local (evita recarregar o pedido inteiro
 * só pra refletir uma avaliação nova).
 */
export function OrderItemReviewForm({
  orderId,
  itemId,
  onSubmitted,
}: OrderItemReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const review = await createReview(orderId, itemId, {
        rating,
        comment: comment.trim() || undefined,
      });
      onSubmitted(review);
    } catch (err) {
      // 409 (já avaliado) e 404 (item não pertence a este pedido) já vêm
      // com mensagem pronta do backend (GlobalExceptionFilter, ver
      // client.ts) — mostrado direto, sem reescrever.
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível enviar sua avaliação. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gap: 8,
        marginTop: 8,
        padding: 12,
        border: "1px solid var(--potala-border)",
        borderRadius: 12,
        maxWidth: 420,
      }}
    >
      <label style={{ display: "grid", gap: 4 }}>
        Sua nota
        <select
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          disabled={isSubmitting}
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} {value === 1 ? "estrela" : "estrelas"}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "grid", gap: 4 }}>
        Comentário (opcional)
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={2000}
          rows={3}
          disabled={isSubmitting}
          style={{ width: "100%", resize: "vertical" }}
        />
      </label>
      {error ? (
        <p role="alert" style={{ color: "var(--potala-danger, #c95c57)", margin: 0 }}>
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={isSubmitting} style={{ justifySelf: "start" }}>
        {isSubmitting ? "Enviando…" : "Enviar avaliação"}
      </button>
    </form>
  );
}
