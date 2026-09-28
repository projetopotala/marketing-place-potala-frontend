"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  COUPON_STATUS_LABEL,
  listActiveCouponsForSeller,
  type Coupon,
} from "@/lib/api/coupons";
import styles from "@/components/seller/seller.module.css";

/**
 * Real via GET /seller/coupons (orders-service, novo nesta sessão --
 * pedido de Arthur, urgente, ver status-migracao-microservicos.md).
 * Substitui o mock antigo (`useAdminData`/`selectSellerCoupons`, cupons
 * fictícios "da loja").
 *
 * Continua somente leitura -- o mock já dizia "criação avançada permanece
 * no admin", e cupom é marketplace-wide (sem sellerId -- ver comentário no
 * model Coupon em schema.prisma), então nunca existiu "cupom da loja" de
 * verdade pra editar aqui.
 *
 * Coluna "Receita" do mock foi removida: media receita atribuída ao cupom
 * *daquela loja*, que não é computável (Coupon não tem sellerId nem
 * vínculo com pedido). O que o backend soma de verdade
 * (totalDiscountCents) é o desconto total concedido pelo cupom em todo o
 * marketplace, não algo específico desta loja -- mostrar aqui confundiria
 * mais do que ajudaria.
 */
export function SellerCouponsView() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await listActiveCouponsForSeller();
        if (!cancelled) setCoupons(result);
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
    <>
      <header>
        <h1 className={styles.pageTitle}>Cupons</h1>
        <p className={styles.pageLead}>
          Promoções vigentes no marketplace. Criação e edição de cupons ficam no admin.
        </p>
      </header>

      <section className={styles.panel}>
        {isLoading ? (
          <p role="status">Carregando cupons…</p>
        ) : error ? (
          <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
            {error}
          </p>
        ) : !coupons || coupons.length === 0 ? (
          <p>Nenhum cupom vigente no momento.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>Desconto</th>
                  <th>Vigência</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td>{coupon.code}</td>
                    <td>{coupon.name}</td>
                    <td>
                      {coupon.discountType === "PERCENT"
                        ? `${coupon.discountValue}%`
                        : (coupon.discountValue / 100).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                    </td>
                    <td>
                      {new Date(coupon.startsAt).toLocaleDateString("pt-BR")} –{" "}
                      {new Date(coupon.endsAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td>
                      <span className={styles.badge}>{COUPON_STATUS_LABEL[coupon.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
