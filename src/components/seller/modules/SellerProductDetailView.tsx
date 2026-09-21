"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getSellerProduct,
  SELLER_PRODUCT_STATUS_LABEL,
  updateSellerProductStatus,
  type SellerProduct,
} from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";
import styles from "@/components/seller/seller.module.css";

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Só o status é editável aqui (publicar/despublicar via PATCH
 * /seller/products/:id) — catalog-service ainda não tem PATCH/DELETE de
 * título/descrição/preço/variante nesta v1 (decisão deliberada de escopo —
 * ver analise-arquitetura-microservicos.md). A versão anterior desta tela
 * editava um objeto em memória (AdminDataContext); isso foi removido em vez
 * de fingir salvar algo que não persiste.
 */
export function SellerProductDetailView() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const toast = useAdminToast();
  const [product, setProduct] = useState<SellerProduct | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

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

  async function handleToggleStatus() {
    if (!product) return;
    const nextStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      const updated = await updateSellerProductStatus(product.id, nextStatus);
      setProduct(updated);
      toast.push(
        nextStatus === "ACTIVE"
          ? "Produto publicado — já aparece na vitrine pública."
          : "Produto despublicado.",
      );
    } catch (err) {
      setStatusError(
        err instanceof ApiError ? err.message : "Não foi possível atualizar o status.",
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  }

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
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1 className={styles.pageTitle}>{product.title}</h1>
          <p className={styles.pageLead}>
            Status: {SELLER_PRODUCT_STATUS_LABEL[product.status]} ·{" "}
            {formatMoney(product.priceCents)}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleToggleStatus}
            disabled={isUpdatingStatus}
          >
            {isUpdatingStatus
              ? "Atualizando…"
              : product.status === "ACTIVE"
                ? "Despublicar"
                : "Publicar"}
          </button>
          {product.status !== "ACTIVE" && product.status !== "INACTIVE" ? (
            <span style={{ fontSize: "0.78rem", color: "var(--seller-muted)" }}>
              Publicar leva direto para Ativo (sem fluxo de revisão nesta v1).
            </span>
          ) : null}
        </div>
      </header>

      {statusError ? (
        <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
          {statusError}
        </p>
      ) : null}

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
          Título, descrição, preço e imagens só podem ser definidos na
          criação — edição e upload de imagem ainda não existem no backend.
        </p>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Imagens</h2>
        {!product.images || product.images.length === 0 ? (
          <p className={styles.pageLead}>
            Nenhuma imagem cadastrada — a vitrine pública mostra um placeholder genérico.
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {product.images.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element -- URL arbitrária hospedada pelo vendedor, fora dos domínios configurados no next/image
              <img
                key={image.id}
                src={image.url}
                alt={image.alt ?? product.title}
                style={{
                  width: 96,
                  height: 96,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "1px solid var(--seller-border)",
                }}
              />
            ))}
          </div>
        )}
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
