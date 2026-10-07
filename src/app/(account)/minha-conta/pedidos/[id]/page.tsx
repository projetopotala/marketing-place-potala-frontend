"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AccountChrome } from "@/components/account/AccountChrome";
import { OrderItemReviewForm } from "@/components/account/OrderItemReviewForm";
import { OrderItemReturnForm } from "@/components/account/OrderItemReturnForm";
import {
  getMyOrder,
  ORDER_STATUS_LABEL,
  PAYMENT_TRANSACTION_STATUS_LABEL,
  type OrderResponse,
} from "@/lib/api/orders";
import type { ReviewResponse } from "@/lib/api/reviews";
import { RETURN_STATUS_LABEL, type ReturnResponse } from "@/lib/api/returns";
import { ApiError } from "@/lib/api/client";
import { formatPrice } from "@/data/marketplace";

/**
 * Detalhe real via GET /orders/:id (orders-service, através do gateway) —
 * substitui a busca em db.orders (localStorage). 404 pra pedido de outro
 * cliente (não 403), mesmo padrão de "404 indistinguível" do resto da API —
 * ApiError já chega com essa mensagem pronta do backend.
 *
 * item.slug/imageSrc não existem em OrderItemResponse (o servidor nunca
 * devolveu isso, ver docs/internal-api-contract.md), então os itens aqui
 * não linkam pro produto como a tela mock antiga fazia.
 *
 * Itens agora são renderizados por SellerOrder, não mais achatados num
 * array só (`sellerOrders.flatMap`) — Fase B do roadmap "estilo Mercado
 * Livre" precisa do `status` de cada SellerOrder pra decidir se mostra o
 * formulário de avaliação/devolução (só libera com DELIVERED -- corrigido
 * em 29/09, alinhado com a correção equivalente em reviews.service.ts/
 * returns.service.ts no potala-orders-service; ver
 * roadmap-mercado-livre.md seção 6/8), e isso só existe no nível do
 * SellerOrder, não no item.
 *
 * Polimento visual (06/10, pré-apresentação): só espaçamento, divisores,
 * títulos e agrupamento visual (estilos inline) foram ajustados nesta
 * passada -- nenhuma condição de status, dado exibido, ou lógica de
 * avaliação/devolução/API mudou.
 */
export default function AccountOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getMyOrder(params.id)
      .then((result) => {
        if (!cancelled) setOrder(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setOrder(null);
        setError(
          err instanceof ApiError ? err.message : "Pedido não encontrado.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const latestPayment = order?.paymentTransactions[order.paymentTransactions.length - 1];

  /** Atualiza só o item avaliado no estado local — evita recarregar o pedido inteiro pra refletir uma avaliação nova. */
  function handleReviewSubmitted(itemId: string, review: ReviewResponse) {
    setOrder((current) => {
      if (!current) return current;
      return {
        ...current,
        sellerOrders: current.sellerOrders.map((sellerOrder) => ({
          ...sellerOrder,
          items: sellerOrder.items.map((item) =>
            item.id === itemId ? { ...item, review } : item,
          ),
        })),
      };
    });
  }

  /** Mesmo raciocínio de handleReviewSubmitted acima — evita recarregar o pedido inteiro pra refletir uma devolução solicitada. */
  function handleReturnSubmitted(itemId: string, returnRequest: ReturnResponse) {
    setOrder((current) => {
      if (!current) return current;
      return {
        ...current,
        sellerOrders: current.sellerOrders.map((sellerOrder) => ({
          ...sellerOrder,
          items: sellerOrder.items.map((item) =>
            item.id === itemId ? { ...item, returnRequest } : item,
          ),
        })),
      };
    });
  }

  const sectionHeadingStyle = {
    margin: "0 0 12px",
    fontSize: "1.05rem",
    fontWeight: 600,
    color: "var(--potala-gold)",
  } as const;

  const dividedSectionStyle = {
    marginTop: 24,
    paddingTop: 20,
    borderTop: "1px solid var(--potala-border)",
  } as const;

  return (
    <AccountChrome
      title={order ? `Pedido ${order.orderNumber}` : "Pedido"}
      breadcrumbCurrent="Detalhe do pedido"
    >
      {isLoading ? (
        <p role="status">Carregando…</p>
      ) : error || !order ? (
        <p role="alert">
          {error ?? "Pedido não encontrado."}{" "}
          <Link href="/minha-conta/pedidos">Voltar à lista</Link>
        </p>
      ) : (
        <>
          <p
            style={{
              margin: "0 0 20px",
              padding: "10px 14px",
              background: "var(--potala-panel)",
              border: "1px solid var(--potala-border)",
              borderRadius: "var(--potala-radius-control, 10px)",
              color: "var(--potala-cream)",
              fontSize: "0.95rem",
            }}
          >
            Status: {ORDER_STATUS_LABEL[order.status]} · Total{" "}
            {formatPrice(order.totalCents / 100)}
          </p>

          <section>
            <h2 style={sectionHeadingStyle}>Itens</h2>
            {order.sellerOrders.map((sellerOrder) => (
              <ul
                key={sellerOrder.id}
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {sellerOrder.items.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      border: "1px solid var(--potala-border)",
                      borderRadius: "var(--potala-radius-control, 10px)",
                      padding: 12,
                    }}
                  >
                    {item.productTitle} ({item.sku}) — {item.quantity}×{" "}
                    {formatPrice(item.unitPriceCents / 100)}
                    {sellerOrder.status === "DELIVERED" ? (
                      item.review ? (
                        <p
                          style={{
                            margin: "4px 0 0",
                            color: "var(--potala-muted, #6b6b6b)",
                          }}
                        >
                          Sua avaliação: {item.review.rating}/5
                          {item.review.comment ? ` — "${item.review.comment}"` : ""}
                        </p>
                      ) : (
                        <OrderItemReviewForm
                          orderId={order.id}
                          itemId={item.id}
                          onSubmitted={(review) => handleReviewSubmitted(item.id, review)}
                        />
                      )
                    ) : null}
                    {sellerOrder.status === "DELIVERED" ? (
                      item.returnRequest ? (
                        <p
                          style={{
                            margin: "4px 0 0",
                            color: "var(--potala-muted, #6b6b6b)",
                          }}
                        >
                          Devolução: {RETURN_STATUS_LABEL[item.returnRequest.status]} —{" "}
                          {item.returnRequest.reason}
                        </p>
                      ) : (
                        <OrderItemReturnForm
                          orderId={order.id}
                          itemId={item.id}
                          onSubmitted={(returnRequest) =>
                            handleReturnSubmitted(item.id, returnRequest)
                          }
                        />
                      )
                    ) : null}
                  </li>
                ))}
              </ul>
            ))}
          </section>

          <section style={dividedSectionStyle}>
            <h2 style={sectionHeadingStyle}>Totais</h2>
            <div
              style={{
                display: "grid",
                gap: 6,
                padding: 12,
                border: "1px solid var(--potala-border)",
                borderRadius: "var(--potala-radius-control, 10px)",
                maxWidth: 420,
              }}
            >
              <p style={{ margin: 0 }}>Subtotal {formatPrice(order.subtotalCents / 100)}</p>
              {order.discountCents > 0 ? (
                <p style={{ margin: 0 }}>Desconto -{formatPrice(order.discountCents / 100)}</p>
              ) : null}
              <p style={{ margin: 0 }}>Frete {formatPrice(order.shippingCents / 100)}</p>
              <p
                style={{
                  margin: "4px 0 0",
                  paddingTop: 6,
                  borderTop: "1px solid var(--potala-border)",
                  fontWeight: 600,
                  color: "var(--potala-cream)",
                }}
              >
                Total {formatPrice(order.totalCents / 100)}
              </p>
            </div>
          </section>

          <section style={dividedSectionStyle}>
            <h2 style={sectionHeadingStyle}>Entrega</h2>
            {order.shippingAddress ? (
              <p style={{ margin: 0 }}>
                {order.shippingAddress.street}, {order.shippingAddress.number}
                {order.shippingAddress.complement
                  ? ` - ${order.shippingAddress.complement}`
                  : ""}{" "}
                — {order.shippingAddress.neighborhood},{" "}
                {order.shippingAddress.city}/{order.shippingAddress.state} ·
                CEP {order.shippingAddress.postalCode}
              </p>
            ) : (
              <p style={{ margin: 0 }}>Endereço não disponível.</p>
            )}
          </section>

          <section style={{ ...dividedSectionStyle, marginBottom: 24 }}>
            <h2 style={sectionHeadingStyle}>Pagamento</h2>
            <p style={{ margin: 0 }}>
              {latestPayment
                ? PAYMENT_TRANSACTION_STATUS_LABEL[latestPayment.status]
                : "Sem transação registrada."}
            </p>
          </section>
        </>
      )}
    </AccountChrome>
  );
}
