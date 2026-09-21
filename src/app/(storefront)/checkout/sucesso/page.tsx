"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StoredOrderSummary } from "@/types/cart";
import { formatCheckoutAddressLabel } from "@/types/cart";
import { ORDER_STORAGE_KEY } from "@/data/cart";
import { parseStoredOrderSummary } from "@/lib/parseStoredOrderSummary";
import { formatPrice } from "@/data/marketplace";
import { useAuth } from "@/context/AuthContext";
import styles from "./page.module.css";

export default function CheckoutSuccessPage() {
  const { user, isAuthenticated, isHydrated } = useAuth();
  const [order, setOrder] = useState<StoredOrderSummary | null>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }

      setOrder(
        parseStoredOrderSummary(
          window.sessionStorage.getItem(ORDER_STORAGE_KEY),
        ),
      );
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const demoPixCode =
    "00020126580014BR.GOV.BCB.PIX0136potala-demo-codigo-ficticio52040000530398654041.005802BR5925INSTITUTO POTALA DEMO6009SAO PAULO62070503***6304ABCD";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(demoPixCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (!ready || !isHydrated) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p role="status">Carregando confirmação…</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <h1 className={styles.title}>Confirmação indisponível</h1>
          <p className={styles.text}>
            Não encontramos um pedido recente neste navegador. Finalize uma compra
            no checkout para visualizar a confirmação.
          </p>
          <Link href="/#produtos" className={styles.primaryBtn}>
            Continuar comprando
          </Link>
        </div>
      </div>
    );
  }

  const isCustomer = isAuthenticated && user?.role === "customer";
  const ordersHref = isCustomer ? "/minha-conta/pedidos" : "/acesso";
  const ordersLabel = isCustomer
    ? "Ver meus pedidos"
    : "Entrar para acompanhar";

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.hero}>
          <span className={styles.check} aria-hidden="true">
            ✓
          </span>
          <h1 className={styles.title}>Pedido realizado com sucesso</h1>
          <p className={styles.code}>
            Código do pedido: <strong>{order.orderId}</strong>
          </p>
          <p className={styles.text}>
            Olá, {order.customerName}. Seu pedido foi registrado no sistema —
            nenhum pagamento real foi processado (ambiente de demonstração).
          </p>
        </div>

        <section className={styles.card} aria-labelledby="success-summary-title">
          <h2 id="success-summary-title">Resumo</h2>
          <ul>
            {order.items.map((item) => (
              <li key={item.productId}>
                <span>
                  {item.quantity}× {item.name}
                </span>
                <span>{formatPrice(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPrice(order.subtotal)}</dd>
            </div>
            <div>
              <dt>Entrega ({order.shippingLabel})</dt>
              <dd>{formatPrice(order.shippingCost)}</dd>
            </div>
            <div>
              <dt>Pagamento</dt>
              <dd>{order.paymentLabel}</dd>
            </div>
            <div>
              <dt>Endereço</dt>
              <dd>
                {formatCheckoutAddressLabel(order.shippingAddress)}
                <br />
                {order.shippingAddress.neighborhood} ·{" "}
                {order.shippingAddress.city}/{order.shippingAddress.state} · CEP{" "}
                {order.shippingAddress.cep}
              </dd>
            </div>
            <div className={styles.total}>
              <dt>Total</dt>
              <dd>{formatPrice(order.total)}</dd>
            </div>
          </dl>
        </section>

        {order.paymentMethod === "pix" ? (
          <section className={styles.pix} aria-labelledby="pix-demo-title">
            <h2 id="pix-demo-title">Pix (demonstração)</h2>
            <div className={styles.qr} aria-hidden="true" />
            <p className={styles.pixCode}>{demoPixCode}</p>
            <button type="button" className={styles.secondaryBtn} onClick={handleCopy}>
              Copiar código
            </button>
            <p role="status" aria-live="polite" className={styles.copyStatus}>
              {copied ? "Código fictício copiado." : "Código demonstrativo — sem validade real."}
            </p>
          </section>
        ) : null}

        <section className={styles.next}>
          <h2>Próximos passos</h2>
          <p>
            {isCustomer
              ? "O pedido também foi registrado no histórico demonstrativo da sua conta neste navegador."
              : "Faça login na área da conta para acompanhar o histórico demonstrativo de pedidos neste navegador."}
          </p>
          <div className={styles.actions}>
            <Link href="/#produtos" className={styles.primaryBtn}>
              Continuar comprando
            </Link>
            <Link href={ordersHref} className={styles.secondaryBtn}>
              {ordersLabel}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
