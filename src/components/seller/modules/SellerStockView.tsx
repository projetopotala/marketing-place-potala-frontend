"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  listSellerProducts,
  updateVariantStock,
  type SellerProduct,
} from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";
import styles from "@/components/seller/seller.module.css";

const PAGE_SIZE = 8;

type VariantRow = {
  productId: string;
  productTitle: string;
  variantId: string;
  sku: string;
  variantName: string;
  quantity: number;
  reservedQuantity: number;
};

function flattenVariants(products: SellerProduct[]): VariantRow[] {
  return products.flatMap((product) =>
    product.variants.map((variant) => ({
      productId: product.id,
      productTitle: product.title,
      variantId: variant.id,
      sku: variant.sku,
      variantName: variant.name,
      quantity: variant.inventory?.quantity ?? 0,
      reservedQuantity: variant.inventory?.reservedQuantity ?? 0,
    })),
  );
}

/**
 * Lista real via GET /seller/products (catalog-service, através do
 * gateway) — reaproveita o mesmo endpoint de SellerProductsView, já que ele
 * traz variantes + inventory no include; não existe (nem precisa existir)
 * um endpoint de listagem próprio pra estoque. Uma linha por variante, não
 * por produto: o mock antigo tratava "estoque do produto" como um único
 * número porque só criava produtos de uma variante, mas o modelo real é
 * por variante (catalog-service não tem "estoque do produto" nenhum campo
 * — ver totalStock() em lib/api/catalog.ts, que soma variantes só pra
 * exibição em outras telas).
 *
 * Edição via PATCH /seller/products/:productId/variants/:variantId/stock
 * (novo endpoint, Fase 3.5 — "estoque do vendedor"): define a quantidade
 * total diretamente (não é reserva de checkout). O backend rejeita (409)
 * um valor abaixo do que já está reservado num pedido em andamento — esse
 * erro aparece inline na própria linha, sem trocar de tela.
 */
export function SellerStockView() {
  const toast = useAdminToast();
  const [products, setProducts] = useState<SellerProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Pilha de cursors já vistos, pra permitir "anterior" com uma API que só
  // oferece nextCursor (cursor-pagination é, por natureza, só pra frente).
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const loadPage = useCallback(async (cursor: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await listSellerProducts({ limit: PAGE_SIZE, cursor });
      setProducts(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setProducts(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar o estoque.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(cursorStack[pageIndex] ?? null);
    // Só a página atual dispara recarga — cursorStack cresce por goNext, não deve reexecutar sozinho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, loadPage]);

  function goNext() {
    if (!hasNextPage || !products || products.length === 0) return;
    const nextCursor = products[products.length - 1]?.id ?? null;
    setCursorStack((stack) => {
      const next = stack.slice(0, pageIndex + 1);
      next.push(nextCursor);
      return next;
    });
    setPageIndex((index) => index + 1);
  }

  function goPrevious() {
    if (pageIndex === 0) return;
    setPageIndex((index) => index - 1);
  }

  async function saveStock(row: VariantRow) {
    const raw = draft[row.variantId];
    const value = Number.parseInt(raw ?? "", 10);
    if (!Number.isFinite(value) || value < 0) {
      setRowErrors((current) => ({
        ...current,
        [row.variantId]: "Informe um número inteiro não-negativo.",
      }));
      return;
    }

    setSavingVariantId(row.variantId);
    setRowErrors((current) => {
      const next = { ...current };
      delete next[row.variantId];
      return next;
    });

    try {
      const snapshot = await updateVariantStock(row.productId, row.variantId, value);
      setProducts((current) =>
        (current ?? []).map((product) =>
          product.id !== row.productId
            ? product
            : {
                ...product,
                variants: product.variants.map((variant) =>
                  variant.id !== row.variantId
                    ? variant
                    : {
                        ...variant,
                        inventory: {
                          quantity: snapshot.quantity,
                          reservedQuantity: snapshot.reservedQuantity,
                        },
                      },
                ),
              },
        ),
      );
      setDraft((current) => {
        const next = { ...current };
        delete next[row.variantId];
        return next;
      });
      toast.push("Estoque atualizado.");
    } catch (err) {
      setRowErrors((current) => ({
        ...current,
        [row.variantId]:
          err instanceof ApiError ? err.message : "Não foi possível atualizar o estoque.",
      }));
    } finally {
      setSavingVariantId(null);
    }
  }

  const rows = products ? flattenVariants(products) : [];

  return (
    <>
      <header>
        <h1 className={styles.pageTitle}>Estoque</h1>
        <p className={styles.pageLead}>
          Ajuste a quantidade em estoque de cada variante da sua loja.
        </p>
      </header>

      <section className={styles.panel}>
        {isLoading ? (
          <p role="status">Carregando estoque…</p>
        ) : error ? (
          <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
            {error}
          </p>
        ) : rows.length === 0 ? (
          <p>Nenhum produto encontrado.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>SKU</th>
                  <th>Reservado</th>
                  <th>Disponível</th>
                  <th>Novo estoque</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const available = row.quantity - row.reservedQuantity;
                  const rowError = rowErrors[row.variantId];
                  const isSaving = savingVariantId === row.variantId;
                  return (
                    <tr key={row.variantId}>
                      <td>
                        <Link
                          href={`/loja/produtos/${row.productId}`}
                          className={styles.rowLink}
                        >
                          {row.productTitle}
                        </Link>
                        {row.variantName !== "Padrão" ? (
                          <span style={{ display: "block", opacity: 0.7 }}>
                            {row.variantName}
                          </span>
                        ) : null}
                      </td>
                      <td>{row.sku}</td>
                      <td>{row.reservedQuantity}</td>
                      <td>{available}</td>
                      <td>
                        <label htmlFor={`stk-${row.variantId}`}>
                          Novo estoque de {row.productTitle}
                        </label>
                        <input
                          id={`stk-${row.variantId}`}
                          inputMode="numeric"
                          style={{
                            minHeight: 44,
                            width: 96,
                            borderRadius: 8,
                            border: "1px solid var(--potala-border)",
                            background: "var(--potala-navy-750)",
                            color: "var(--potala-text-primary)",
                            padding: "0 8px",
                          }}
                          value={draft[row.variantId] ?? String(row.quantity)}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              [row.variantId]: event.target.value,
                            }))
                          }
                          disabled={isSaving}
                        />
                        {rowError ? (
                          <p
                            role="alert"
                            style={{
                              color: "var(--potala-danger, #c95c57)",
                              margin: "4px 0 0",
                              fontSize: "0.85em",
                            }}
                          >
                            {rowError}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.ghostBtn}
                          disabled={isSaving}
                          onClick={() => saveStock(row)}
                        >
                          {isSaving ? "Salvando…" : "Salvar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={pageIndex === 0 || isLoading}
            onClick={goPrevious}
          >
            Anterior
          </button>
          <span>Página {pageIndex + 1}</span>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={!hasNextPage || isLoading}
            onClick={goNext}
          >
            Próxima
          </button>
        </div>
      </section>
    </>
  );
}
