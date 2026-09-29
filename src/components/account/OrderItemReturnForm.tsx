"use client";

import { useState, type FormEvent } from "react";
import { createReturn, type ReturnResponse } from "@/lib/api/returns";
import { ApiError } from "@/lib/api/client";

interface OrderItemReturnFormProps {
  orderId: string;
  itemId: string;
  onSubmitted: (returnRequest: ReturnResponse) => void;
}

/**
 * Devoluções -- mesmo raciocínio de OrderItemReviewForm.tsx: a página de
 * detalhe do pedido decide QUANDO mostrar isto (item de um SellerOrder
 * DELIVERED ainda sem devolução solicitada -- corrigido em 29/09, ver
 * returns.service.ts), este componente só cuida do
 * formulário em si. Sem reembolso/reposição de estoque automáticos --
 * isto só registra o pedido de devolução, um admin decide depois (ver
 * comentário do model Return, orders-service).
 */
export function OrderItemReturnForm({
  orderId,
  itemId,
  onSubmitted,
}: OrderItemReturnFormProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const returnRequest = await createReturn(orderId, itemId, {
        reason: reason.trim(),
        description: description.trim() || undefined,
      });
      onSubmitted(returnRequest);
    } catch (err) {
      // 409 (já solicitado, ou SellerOrder ainda não confirmado) e 404
      // (item não pertence a este pedido) já vêm com mensagem pronta do
      // backend (GlobalExceptionFilter, ver client.ts) -- mostrado direto.
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível enviar sua solicitação. Tente novamente.",
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
        Motivo
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={200}
          required
          disabled={isSubmitting}
          style={{ minHeight: 44 }}
        />
      </label>
      <label style={{ display: "grid", gap: 4 }}>
        Descrição (opcional)
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
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
        {isSubmitting ? "Enviando…" : "Solicitar devolução"}
      </button>
    </form>
  );
}
