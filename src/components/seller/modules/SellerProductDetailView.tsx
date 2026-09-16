"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getSellerProduct,
  SELLER_PRODUCT_STATUS_LABEL,
  type SellerProduct,
} from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import styles from "@/components/seller/seller.module.css";

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Somente leitura: catalog-service não tem PATCH/DELETE de produto/variante
 * nesta v1 (decisão deliberada de escopo — ver analise-arquitetura-microservicos.md),
 * então não há nada real pra um formulário de edição chamar aqui. A versão
 * anterior desta tela editava um objeto em memória (AdminDataContext); isso
 * foi removido em vez de fingir salvar algo que não persiste.
 */
export function SellerProductDetailView() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const [product, setProduct] = useState<SellerProduct | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getSellerProduct(productId)
      .then((result) => {
        if (!cancelled) setProduct(result);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError({ status: err.status, message: err.message });
        } else {
          setError({ status: 0, message: "Não foi possível carregar o produto." });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (isLoading) {
    return <p role="status">Carregando produto…</p>;
  }

  if (error || !product) {
    return (
      <section className={styles.denied} role="alert">
        <h1 className={styles.pageTitle}>Produto indisponível</h1>
        <p>
          {error?.status === 404
            ? "Este produto não pertence à sua loja ou não existe."
            : error?.message ?? "Não foi possível carregar este produto."}
        </p>
      </section>
    );
  }

  return (
    <>
      <header>
        <h1 className={styles.pageTitle}>{product.title}</h1>
        <p className={styles.pageLead}>
          Status: {SELLER_PRODUCT_STATUS_LABEL[product.status]} ·{" "}
          {formatMoney(product.priceCents)}
        </p>
      </header>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Detalhes</h2>
        <dl style={{ display: "grid", gap: 8 }}>
          <div>
            <strong>Descrição:</strong> {product.description || "—"}
          </div>
          <div>
            <strong>Slug:</strong> {product.slug}
          </div>
          <div>
            <strong>Categoria (ID):</strong> {product.categoryId}
          </div>
          <div>
            <strong>Destaque:</strong> {product.featured ? "Sim" : "Não"}
          </div>
        </dl>
        <p className={styles.pageLead} style={{ marginTop: 12 }}>
          Edição, envio para revisão e upload de imagem ainda não existem no
          backend — esta tela é só leitura por enquanto.
        </p>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Variantes e estoque</h2>
        {product.variants.length === 0 ? (
          <p>Nenhuma variante cadastrada.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Variante</th>
                  <th>SKU</th>
                  <th>Preço</th>
                  <th>Ativa</th>
                  <th>Estoque</th>
                  <th>Reservado</th>
                </tr>
              </thead>
              <tbody>
                {product.variants.map((variant) => (
                  <tr key={variant.id}>
                    <td>{variant.name}</td>
                    <td>{variant.sku}</td>
                    <td>
                      {variant.priceCents != null
                        ? formatMoney(variant.priceCents)
                        : "Preço do produto"}
                    </td>
                    <td>{variant.active ? "Sim" : "Não"}</td>
                    <td>{variant.inventory?.quantity ?? 0}</td>
                    <td>{variant.inventory?.reservedQuantity ?? 0}</td>
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
