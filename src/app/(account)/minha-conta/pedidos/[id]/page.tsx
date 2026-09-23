"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AccountChrome } from "@/components/account/AccountChrome";
import { OrderItemReviewForm } from "@/components/account/OrderItemReviewForm";
import {
  getMyOrder,
  ORDER_STATUS_LABEL,
  PAYMENT_TRANSACTION_STATUS_LABEL,
  type OrderResponse,
} from "@/lib/api/orders";
import type { ReviewResponse } from "@/lib/api/reviews";
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
 * formulário de avaliação (só libera com CONFIRMED, ver
 * roadmap-mercado-livre.md seção 6/8), e isso só existe no nível do
 * SellerOrder, não no item.
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
          <p>
            Status: {ORDER_STATUS_LABEL[order.status]} · Total{" "}
            {formatPrice(order.totalCents / 100)}
          </p>

          <section>
            <h2>Itens</h2>
            {order.sellerOrders.map((sellerOrder) => (
              <ul key={sellerOrder.id} style={{ marginBottom: 16 }}>
                {sellerOrder.items.map((item) => (
                  <li key={item.id} style={{ marginBottom: 12 }}>
                    {item.productTitle} ({item.sku}) — {item.quantity}×{" "}
                    {formatPrice(item.unitPriceCents / 100)}
                    {sellerOrder.status === "CONFIRMED" ? (
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
                  </li>
                ))}
              </ul>
            ))}
          </section>

          <section>
            <h2>Totais</h2>
            <p>Subtotal {formatPrice(order.subtotalCents / 100)}</p>
            <p>Frete {formatPrice(order.shippingCents / 100)}</p>
            <p>Total {formatPrice(order.totalCents / 100)}</p>
          </section>

          <section>
            <h2>Entrega</h2>
            {order.shippingAddress ? (
              <p>
                {order.shippingAddress.street}, {order.shippingAddress.number}
                {order.shippingAddress.complement
                  ? ` - ${order.shippingAddress.complement}`
                  : ""}{" "}
                — {order.shippingAddress.neighborhood},{" "}
                {order.shippingAddress.city}/{order.shippingAddress.state} ·
                CEP {order.shippingAddress.postalCode}
              </p>
            ) : (
              <p>Endereço não disponível.</p>
            )}
          </section>

          <section>
            <h2>Pagamento</h2>
            <p>
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
