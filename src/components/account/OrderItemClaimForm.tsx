"use client";

import { useState, type FormEvent } from "react";
import { createClaim, type ClaimResponse } from "@/lib/api/claims";
import { ApiError } from "@/lib/api/client";

interface OrderItemClaimFormProps {
  orderId: string;
  itemId: string;
  onSubmitted: (claim: ClaimResponse) => void;
}

/**
 * Reclamações -- mesmo raciocínio visual de OrderItemReturnForm.tsx/
 * OrderItemReviewForm.tsx: a página de detalhe do pedido decide QUANDO
 * mostrar isto (item de um SellerOrder num status elegível -- CONFIRMED,
 * PREPARING, SHIPPED ou DELIVERED; NUNCA exige DELIVERED como devolução/
 * avaliação exigem, ver `CLAIM_ELIGIBLE_SELLER_ORDER_STATUSES` em
 * claims.service.ts, orders-service), este componente só cuida do
 * formulário em si. maxLength de cada campo espelha exatamente
 * MAX_CLAIM_REASON_LENGTH (200) / MAX_CLAIM_DESCRIPTION_LENGTH (2000)
 * (orders.constants.ts) -- mesmos valores já usados em
 * OrderItemReturnForm.tsx, confirmados de novo nesta rodada antes de
 * implementar (não presumidos).
 */
export function OrderItemClaimForm({
  orderId,
  itemId,
  onSubmitted,
}: OrderItemClaimFormProps) {
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
      const claim = await createClaim(orderId, itemId, {
        reason: reason.trim(),
        description: description.trim() || undefined,
      });
      onSubmitted(claim);
    } catch (err) {
      // 409 (SellerOrder ainda não elegível) e 404 (item não pertence a
      // este pedido) já vêm com mensagem pronta do backend
      // (GlobalExceptionFilter, ver client.ts) -- mostrado direto.
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível enviar sua reclamação. Tente novamente.",
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
        gap: 12,
        marginTop: 12,
        padding: 16,
        background: "var(--potala-panel)",
        border: "1px solid var(--potala-border)",
        borderRadius: "var(--potala-radius-control, 12px)",
        maxWidth: 420,
      }}
    >
      <label
        style={{
          display: "grid",
          gap: 6,
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "var(--potala-cream)",
        }}
      >
        Motivo
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={200}
          required
          disabled={isSubmitting}
          style={{
            minHeight: 44,
            padding: "0 0.75rem",
            border: "1px solid var(--potala-border)",
            borderRadius: "var(--potala-radius-control, 10px)",
            background: "var(--potala-bg)",
            color: "var(--potala-text)",
            fontSize: "0.9rem",
            fontWeight: 400,
          }}
        />
      </label>
      <label
        style={{
          display: "grid",
          gap: 6,
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "var(--potala-cream)",
        }}
      >
        Descrição (opcional)
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2000}
          rows={3}
          disabled={isSubmitting}
          style={{
            width: "100%",
            resize: "vertical",
            padding: "0.5rem 0.75rem",
            border: "1px solid var(--potala-border)",
            borderRadius: "var(--potala-radius-control, 10px)",
            background: "var(--potala-bg)",
            color: "var(--potala-text)",
            fontSize: "0.9rem",
            fontWeight: 400,
          }}
        />
      </label>
      {error ? (
        <p
          role="alert"
          style={{ color: "var(--potala-danger, #c95c57)", margin: 0, fontSize: "0.85rem" }}
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          justifySelf: "start",
          padding: "0.6rem 1.25rem",
          border: "none",
          borderRadius: "var(--potala-radius-button, 8px)",
          background: "var(--potala-gold)",
          color: "var(--potala-bg)",
          fontWeight: 600,
          fontSize: "0.9rem",
          cursor: isSubmitting ? "default" : "pointer",
          opacity: isSubmitting ? 0.7 : 1,
        }}
      >
        {isSubmitting ? "Enviando…" : "Abrir reclamação"}
      </button>
    </form>
  );
}
