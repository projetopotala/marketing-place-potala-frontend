"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ADMIN_PRODUCT_STATUS_LABEL,
  activateAdminProduct,
  deactivateAdminProduct,
  listAdminProducts,
  listAdminSellers,
  totalAdminProductStock,
  type AdminProduct,
  type AdminProductStatus,
  type AdminSeller,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminDataTable, sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminStatusBadge, AdminEmptyState } from "@/components/admin/shared/AdminStatusBadge";
import { AdminConfirmDialog } from "@/components/admin/shared/AdminModal";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";

/**
 * Real via GET/PATCH /admin/products (catalog-service) -- ver o comentário
 * completo em lib/api/admin.ts sobre o que foi cortado do mock antigo
 * (busca, filtro, ordenar, CSV, seleção em lote, Aprovar/Rejeitar,
 * Destacar, Editar, tela de detalhe) e por quê.
 */

const PAGE_SIZE = 10;
const SELLERS_LIMIT = 100;

function productTone(status: AdminProductStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "REVIEW") return "warning" as const;
  if (status === "REJECTED") return "danger" as const;
  return "muted" as const;
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function ProductsView() {
  const toast = useAdminToast();
  const [sellers, setSellers] = useState<AdminSeller[] | null>(null);
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminProduct | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAdminSellers({ limit: SELLERS_LIMIT })
      .then((page) => {
        if (!cancelled) setSellers(page.items);
      })
      .catch(() => {
        // Nome da loja é só um complemento visual -- se essa chamada falhar,
        // a tabela ainda funciona mostrando o sellerId cru no lugar do nome.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPage = useCallback(async (cursor: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await listAdminProducts({ limit: PAGE_SIZE, cursor });
      setProducts(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setProducts(null);
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar os produtos.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(cursorStack[pageIndex] ?? null);
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

  const sellerName = useMemo(() => {
    const map = new Map((sellers ?? []).map((s) => [s.id, s.tradeName]));
    return (id: string) => map.get(id) ?? id;
  }, [sellers]);

  function applyResult(id: string, updated: AdminProduct) {
    setProducts((current) =>
      current ? current.map((p) => (p.id === id ? updated : p)) : current,
    );
  }

  async function confirmStatusChange() {
    if (!statusTarget) return;
    setPendingActionId(statusTarget.id);
    try {
      const result =
        statusTarget.status === "ACTIVE"
          ? await deactivateAdminProduct(statusTarget.id)
          : await activateAdminProduct(statusTarget.id);
      applyResult(statusTarget.id, result);
      toast.push(result.status === "ACTIVE" ? "Produto ativado" : "Produto desativado");
      setStatusTarget(null);
    } catch (err) {
      toast.push(
        err instanceof ApiError ? err.message : "Não foi possível concluir a ação.",
        "error",
      );
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader
        title="Produtos"
        description="Todos os produtos de todas as lojas, direto do catalog-service."
      />

      {isLoading ? (
        <p role="status">Carregando produtos…</p>
      ) : error ? (
        <AdminEmptyState title="Não foi possível carregar os produtos" description={error} />
      ) : (
        <AdminDataTable
          caption="Lista de produtos"
          rows={products ?? []}
          columns={[
            { key: "title", header: "Produto", render: (row) => row.title },
            { key: "seller", header: "Vendedor", render: (row) => sellerName(row.sellerId) },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <AdminStatusBadge
                  label={ADMIN_PRODUCT_STATUS_LABEL[row.status]}
                  tone={productTone(row.status)}
                />
              ),
            },
            { key: "price", header: "Preço", render: (row) => formatMoney(row.priceCents) },
            {
              key: "stock",
              header: "Estoque",
              render: (row) => String(totalAdminProductStock(row)),
            },
            {
              key: "actions",
              header: "Ações",
              render: (row) =>
                row.status === "ACTIVE" || row.status === "INACTIVE" ? (
                  <button
                    type="button"
                    className={sharedStyles.linkBtn}
                    disabled={pendingActionId === row.id}
                    onClick={() => setStatusTarget(row)}
                  >
                    {row.status === "ACTIVE" ? "Desativar" : "Ativar"}
                  </button>
                ) : (
                  <span>—</span>
                ),
            },
          ]}
          mobileCard={(row) => (
            <>
              <strong>{row.title}</strong>
              <span>{sellerName(row.sellerId)}</span>
              <AdminStatusBadge
                label={ADMIN_PRODUCT_STATUS_LABEL[row.status]}
                tone={productTone(row.status)}
              />
              <span>
                {formatMoney(row.priceCents)} · estoque {totalAdminProductStock(row)}
              </span>
            </>
          )}
        />
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
        <button
          type="button"
          className={sharedStyles.btnGhost}
          disabled={pageIndex === 0 || isLoading}
          onClick={goPrevious}
        >
          Anterior
        </button>
        <span>Página {pageIndex + 1}</span>
        <button
          type="button"
          className={sharedStyles.btnGhost}
          disabled={!hasNextPage || isLoading}
          onClick={goNext}
        >
          Próxima
        </button>
      </div>

      <AdminConfirmDialog
        open={Boolean(statusTarget)}
        title={statusTarget?.status === "ACTIVE" ? "Desativar produto" : "Ativar produto"}
        description={`Confirma alterar o status de ${statusTarget?.title ?? ""}?`}
        confirmLabel="Confirmar"
        busy={pendingActionId === statusTarget?.id}
        onConfirm={() => void confirmStatusChange()}
        onClose={() => setStatusTarget(null)}
      />
    </div>
  );
}
