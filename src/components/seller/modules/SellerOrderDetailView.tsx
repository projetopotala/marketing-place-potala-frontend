"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getMySellerOrder,
  SELLER_ORDER_STATUS_LABEL,
  type SellerOrderForSellerResponse,
} from "@/lib/api/orders";
import { ApiError } from "@/lib/api/client";
import styles from "@/components/seller/seller.module.css";

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Detalhe real via GET /seller/orders/:id (orders-service, através do
 * gateway) — substitui o mock antigo baseado em AdminDataContext. 404 pra
 * SellerOrder de outra loja (não 403), mesmo padrão de "404 indistinguível"
 * do resto da API — ApiError já chega com essa mensagem pronta do backend.
 *
 * Somente leitura nesta v1 (ver status-migracao-microservicos.md, "Fase 3 —
 * pedidos do vendedor"): a versão mock tinha avançar-status, registrar
 * rastreio e uma timeline de eventos — nenhum desses tem equivalente no
 * backend real ainda (SellerOrdersController só expõe GET), então ficaram
 * de fora aqui deliberadamente, como um follow-up separado e já sinalizado
 * a Arthur.
 */
export function SellerOrderDetailView() {
  const params = useParams<{ id: string }>();
  const [sellerOrder, setSellerOrder] = useState<SellerOrderForSellerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getMySellerOrder(params.id)
      .then((result) => {
        if (!cancelled) setSellerOrder(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setSellerOrder(null);
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

  if (isLoading) {
    return <p role="status">Carregando pedido…</p>;
  }

  if (error || !sellerOrder) {
    return (
      <section className={styles.denied} role="alert">
        <h1 className={styles.pageTitle}>Pedido indisponível</h1>
        <p>
          {error ?? "Este pedido não pertence à sua loja."}{" "}
          <Link href="/loja/pedidos">Voltar à lista</Link>
        </p>
      </section>
    );
  }

  const address = sellerOrder.order.shippingAddress;

  return (
    <>
      <header>
        <h1 className={styles.pageTitle}>
          Pedido {sellerOrder.order.orderNumber}
        </h1>
        <p className={styles.pageLead}>
          {SELLER_ORDER_STATUS_LABEL[sellerOrder.status]} ·{" "}
          {formatMoney(sellerOrder.subtotalCents)}
        </p>
      </header>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Itens</h2>
        <ul>
          {sellerOrder.items.map((item) => (
            <li key={item.id}>
              {item.quantity}× {item.productTitle} ({item.sku}) —{" "}
              {formatMoney(item.lineTotalCents)}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Totais</h2>
        <p>
          Subtotal {formatMoney(sellerOrder.subtotalCents)} · Frete{" "}
          {formatMoney(sellerOrder.shippingCents)} · Comissão{" "}
          {formatMoney(sellerOrder.commissionCents)} · Líquido{" "}
          {formatMoney(sellerOrder.sellerNetCents)}
        </p>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Entrega</h2>
        {address ? (
          <p>
            {address.recipient} — {address.street}, {address.number}
            {address.complement ? ` - ${address.complement}` : ""} —{" "}
            {address.neighborhood}, {address.city}/{address.state} · CEP{" "}
            {address.postalCode}
          </p>
        ) : (
          <p>Endereço não disponível.</p>
        )}
      </section>
    </>
  );
}
