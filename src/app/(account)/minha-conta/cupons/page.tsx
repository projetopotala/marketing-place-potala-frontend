"use client";

import { useEffect, useState } from "react";
import { AccountChrome } from "@/components/account/AccountChrome";
import { ActiveCoupons } from "@/components/account/ActiveCoupons";
import { ApiError } from "@/lib/api/client";
import { listActiveCouponsForCustomer, type Coupon } from "@/lib/api/coupons";
import type { AccountCoupon } from "@/types/account";

/**
 * Real via GET /orders/coupons (orders-service, novo nesta sessão) --
 * substitui o mock "demonstrativo" antigo (`ACCOUNT_ACTIVE_COUPONS`,
 * `src/data/account.ts`). Mesmo cupom marketplace-wide já usado em
 * SellerCouponsView.tsx (sem sellerId -- ver comentário no model Coupon em
 * schema.prisma).
 *
 * `ActiveCoupons` (componente) continua esperando o shape antigo
 * (`AccountCoupon`: code/description/expiresAt) -- ele também é usado no
 * dashboard de `/minha-conta` (`page.tsx`), que ainda não entrou no
 * escopo desta rodada (mock, ver status-migracao-microservicos.md), então
 * o componente em si não foi alterado. Aqui só mapeamos o `Coupon` real
 * pro mesmo shape, mesma formatação de desconto/vigência já usada em
 * SellerCouponsView.tsx.
 */
function toAccountCoupon(coupon: Coupon): AccountCoupon {
  const discount =
    coupon.discountType === "PERCENT"
      ? `${coupon.discountValue}% de desconto`
      : `${(coupon.discountValue / 100).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })} de desconto`;

  return {
    id: coupon.id,
    code: coupon.code,
    description: `${coupon.name} · ${discount}`,
    expiresAt: new Date(coupon.endsAt).toLocaleDateString("pt-BR"),
  };
}

export default function AccountCouponsPage() {
  const [coupons, setCoupons] = useState<AccountCoupon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await listActiveCouponsForCustomer();
        if (!cancelled) setCoupons(result.map(toAccountCoupon));
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Não foi possível carregar os cupons.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AccountChrome
      title="Cupons"
      lead="Cupons vigentes no marketplace."
      breadcrumbCurrent="Cupons"
    >
      {isLoading ? (
        <p role="status">Carregando cupons…</p>
      ) : error ? (
        <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
          {error}
        </p>
      ) : !coupons || coupons.length === 0 ? (
        <p>Nenhum cupom vigente no momento.</p>
      ) : (
        <ActiveCoupons coupons={coupons} />
      )}
    </AccountChrome>
  );
}
