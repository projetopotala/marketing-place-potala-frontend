"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  listSellerProducts,
  SELLER_PRODUCT_STATUS_LABEL,
  totalStock,
  type SellerProduct,
} from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import styles from "@/components/seller/seller.module.css";

const PAGE_SIZE = 8;

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Lista real via GET /seller/products (catalog-service, através do
 * gateway). Sem busca por texto nem filtro por status aqui — o backend só
 * pagina por cursor (PaginationQueryDto: limit/cursor), não tem parâmetro
 * de busca; filtrar isso exigiria trazer todo o catálogo pro cliente, o que
 * o endpoint não foi feito para suportar.
 */
export function SellerProductsView() {
  const [products, setProducts] = useState<SellerProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Pilha de cursors já vistos, pra permitir "anterior" com uma API que só
  // oferece nextCursor (cursor-pagination é, por natureza, só pra frente).
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
          : "Não foi possível carregar os produtos.",
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
          <h1 className={styles.pageTitle}>Produtos</h1>
          <p className={styles.pageLead}>
            Seus produtos cadastrados no catálogo, direto do catalog-service.
          </p>
        </div>
        <Link href="/loja/produtos/novo" className={styles.primaryBtn}>
          Novo produto
        </Link>
      </header>

      <section className={styles.panel}>
        {isLoading ? (
          <p role="status">Carregando produtos…</p>
        ) : error ? (
          <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
            {error}
          </p>
        ) : !products || products.length === 0 ? (
          <p>Nenhum produto encontrado.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Status</th>
                  <th>Estoque</th>
                  <th>Preço</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <Link
                        href={`/loja/produtos/${product.id}`}
                        className={styles.rowLink}
                      >
                        {product.title}
                      </Link>
                    </td>
                    <td>
                      <span className={styles.badge}>
                        {SELLER_PRODUCT_STATUS_LABEL[product.status]}
                      </span>
                    </td>
                    <td>{totalStock(product)}</td>
                    <td>{formatMoney(product.priceCents)}</td>
                  </tr>
                ))}
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
