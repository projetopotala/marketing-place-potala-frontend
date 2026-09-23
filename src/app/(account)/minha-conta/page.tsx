"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ACCOUNT_ACTIVE_COUPONS, ACCOUNT_WELCOME_STATS } from "@/data/account";
import { AccountChrome } from "@/components/account/AccountChrome";
import { AccountWelcomePanel } from "@/components/account/AccountWelcomePanel";
import { AccountMetricCard } from "@/components/account/AccountMetricCard";
import { ActiveCoupons } from "@/components/account/ActiveCoupons";
import { useAuth } from "@/context/AuthContext";
import { useAccountData } from "@/features/account/AccountDataContext";
import {
  getMyCustomerProfile,
  type CustomerAddressResponse,
  type CustomerProfileResponse,
} from "@/lib/api/customers";
import { listMyOrders, ORDER_STATUS_LABEL, type OrderResponse } from "@/lib/api/orders";
import { formatPrice } from "@/data/marketplace";
import styles from "./page.module.css";

function formatMemberSince(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return ACCOUNT_WELCOME_STATS.memberSince;
  const label = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatAddressLine(address: CustomerAddressResponse): string {
  const complement = address.complement ? ` — ${address.complement}` : "";
  return `${address.street}, ${address.number}${complement} — ${address.neighborhood}, ${address.city}/${address.state} · ${address.postalCode}`;
}

/**
 * Perfil rico do cliente (novo nesta sessão — ver item 3 do "Pendente" em
 * status-migracao-microservicos.md). `profile` (GET /customers/me) e
 * `realOrders` (GET /orders, até 50) substituem o que antes vinha só do
 * mock local (AccountDataContext/localStorage) — favoritos, cupons e
 * avaliações pendentes continuam mock, sem model correspondente no
 * backend (decisão de escopo já registrada). As duas chamadas degradam
 * pra vazio/null em falha (mesmo padrão de catalog-public.ts) em vez de
 * derrubar a página.
 */
export default function MinhaContaPage() {
  const { user } = useAuth();
  const { db, isHydrated } = useAccountData();
  const name = user?.name?.trim() || "Cliente Potala";

  const [profile, setProfile] = useState<CustomerProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [realOrders, setRealOrders] = useState<OrderResponse[] | null>(null);
  const [realOrdersHasMore, setRealOrdersHasMore] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getMyCustomerProfile().then((result) => {
      if (!cancelled) {
        setProfile(result);
        setProfileLoading(false);
      }
    });

    listMyOrders({ limit: 50 })
      .then((page) => {
        if (cancelled) return;
        setRealOrders(page.items);
        setRealOrdersHasMore(page.pageInfo.hasNextPage);
      })
      .catch((err) => {
        console.error(
          "[minha-conta] listMyOrders falhou, degradando para lista vazia:",
          err,
        );
        if (!cancelled) {
          setRealOrders([]);
          setRealOrdersHasMore(false);
        }
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const favorites = db?.favorites ?? [];
  const pendingReviews =
    db?.reviews.filter((review) => review.status === "pending").length ?? 0;

  const realAddresses = profile?.addresses ?? [];
  const nonCancelledOrders = (realOrders ?? []).filter(
    (order) => order.status !== "CANCELLED",
  );
  // Soma só da página carregada (até 50 pedidos) — aproximação, não o
  // total histórico exato se o cliente tiver mais que isso (ver "+" no
  // rótulo abaixo). GET /orders só pagina por cursor, sem contagem total.
  const totalSpent =
    nonCancelledOrders.reduce((sum, order) => sum + order.totalCents, 0) / 100;
  const totalOrdersLabel = realOrders
    ? `${realOrders.length}${realOrdersHasMore ? "+" : ""}`
    : String(ACCOUNT_WELCOME_STATS.totalOrders);
  const memberSince = profile?.createdAt
    ? formatMemberSince(profile.createdAt)
    : ACCOUNT_WELCOME_STATS.memberSince;

  const metrics = [
    {
      id: "pedidos-recentes",
      label: "Pedidos",
      value: ordersLoading ? "…" : totalOrdersLabel,
      hint: "Direto do orders-service",
    },
    {
      id: "cupons",
      label: "Cupons disponíveis",
      value: String(ACCOUNT_ACTIVE_COUPONS.length),
      hint: "Prontos para uso",
    },
    {
      id: "enderecos",
      label: "Endereços cadastrados",
      value: profileLoading ? "…" : String(realAddresses.length),
      hint: "Direto do identity-service",
    },
    {
      id: "favoritos",
      label: "Favoritos",
      value: String(favorites.length),
      hint: "Lista de desejos",
    },
    {
      id: "avaliacoes",
      label: "Avaliações pendentes",
      value: String(pendingReviews),
      hint: "Aguardando sua opinião",
    },
  ];

  return (
    <AccountChrome
      title="Resumo da Conta"
      lead="Acompanhe suas atividades, pedidos e preferências em um só lugar."
      breadcrumbCurrent="Resumo da Conta"
    >
      {!isHydrated ? (
        <p role="status">Carregando dados da conta…</p>
      ) : (
        // Bug real encontrado nesta sessao: essa condicao exigia
        // `isHydrated && db`, mas AccountDataContext SEMPRE deixa `db`
        // null pra qualquer usuario que nao seja role === "customer"
        // (vendedor, admin) -- por design, nao por falha de carregamento.
        // Resultado: um vendedor/admin que caisse em /minha-conta ficava
        // preso pra sempre em "Carregando dados da conta...", porque
        // `db` nunca deixava de ser null. `favorites`/`pendingReviews`
        // logo abaixo ja tratam `db` nulo com `db?.` (viram lista vazia/
        // 0), entao bastava nao gatear a tela inteira por `db`.
        <>
          <AccountWelcomePanel
            name={name}
            memberSince={memberSince}
            totalOrders={totalOrdersLabel}
            totalSpent={totalSpent}
          />

          <section className={styles.metrics} aria-label="Indicadores da conta">
            {metrics.map((metric) => (
              <AccountMetricCard key={metric.id} metric={metric} />
            ))}
          </section>

          <div className={styles.lower}>
            <section aria-labelledby="recent-orders-title">
              <h2 id="recent-orders-title">Pedidos recentes</h2>
              {ordersLoading ? (
                <p role="status">Carregando pedidos…</p>
              ) : !realOrders || realOrders.length === 0 ? (
                <p>Nenhum pedido no histórico ainda.</p>
              ) : (
                <ul>
                  {realOrders.slice(0, 3).map((order) => (
                    <li key={order.id}>
                      <Link href={`/minha-conta/pedidos/${order.id}`}>
                        {order.orderNumber}
                      </Link>{" "}
                      · {ORDER_STATUS_LABEL[order.status]} ·{" "}
                      {formatPrice(order.totalCents / 100)}
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/minha-conta/pedidos">Ver todos</Link>
            </section>

            <ActiveCoupons coupons={ACCOUNT_ACTIVE_COUPONS} />

            <section aria-labelledby="addr-title">
              <h2 id="addr-title">Endereços</h2>
              {profileLoading ? (
                <p role="status">Carregando endereços…</p>
              ) : realAddresses.length === 0 ? (
                <p>Nenhum endereço cadastrado ainda.</p>
              ) : (
                <ul>
                  {realAddresses.map((address) => (
                    <li key={address.id}>
                      {address.label ?? "Endereço"}
                      {address.isDefault ? " (padrão)" : ""} —{" "}
                      {formatAddressLine(address)}
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/minha-conta/enderecos">Gerenciar</Link>
            </section>

            <section aria-labelledby="fav-title">
              <h2 id="fav-title">Favoritos</h2>
              {favorites.length === 0 ? (
                <p>Sua lista de desejos está vazia.</p>
              ) : (
                <ul>
                  {favorites.slice(0, 4).map((item) => (
                    <li key={item.productId}>
                      <Link href={`/produto/${item.slug}`}>{item.name}</Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/minha-conta/favoritos">Ver favoritos</Link>
            </section>
          </div>
        </>
      )}
    </AccountChrome>
  );
}
