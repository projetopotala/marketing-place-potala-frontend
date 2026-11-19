"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listAdminOrders,
  listAdminSellers,
  type AdminSeller,
  type AdminSellerOrder,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { SELLER_ORDER_STATUS_LABEL, type SellerOrderStatus } from "@/lib/api/orders";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminDataTable, sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminStatusBadge, AdminEmptyState } from "@/components/admin/shared/AdminStatusBadge";

/**
 * Real via GET /admin/orders (orders-service) — mesmo endpoint novo criado
 * pro Financeiro admin (ver status-migracao-microservicos.md). Substitui o
 * mock antigo (`useAdminData`, `db.orders`, com busca, filtro por status,
 * exportação CSV e transições "Marcar pago"/"Separar"/"Enviar").
 *
 * Removido de propósito, mesmo raciocínio já usado em SellersView.tsx:
 * - Sem busca nem filtro por status server-side: o backend só pagina por
 *   cursor (PaginationQueryDto: limit/cursor). Filtrar só a página
 *   carregada pareceria filtrar tudo e não filtraria de verdade.
 * - Sem exportar CSV: só exportaria a página atual (até 10 linhas), não
 *   os pedidos todos — enganoso chamar isso de "exportar".
 * - Sem ações de mudar status ("Marcar pago"/"Separar"/"Enviar"): não
 *   existe PATCH admin de pedido em nenhum backend real desta v1 —
 *   AdminOrdersController só tem GET.
 * - Sem link pra tela de detalhe: não existe GET /admin/orders/:id (mesma
 *   decisão de escopo já tomada em SellersView, que também não linka pra
 *   detalhe por não existir GET /admin/sellers/:id).
 *
 * Mostra `SellerOrder.status` (rastreio/fulfillment: pendente, confirmado,
 * em preparação, enviado, entregue...), não `Order.status` (pagamento) —
 * esse é o Financeiro (FinanceView.tsx), este é Pedidos: mesma distinção
 * já documentada em SellerFinanceView.tsx vs. a tela /loja/pedidos do
 * vendedor.
 */

const PAGE_SIZE = 10;
const SELLERS_LIMIT = 100;

function orderTone(status: SellerOrderStatus) {
  if (status === "DELIVERED" || status === "SHIPPED") return "success" as const;
  if (status === "PENDING") return "warning" as const;
  if (status === "CANCELLED") return "danger" as const;
  return "info" as const;
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function OrdersView() {
  const [sellers, setSellers] = useState<AdminSeller[] | null>(null);
  const [orders, setOrders] = useState<AdminSellerOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAdminSellers({ limit: SELLERS_LIMIT })
      .then((page) => {
        if (!cancelled) setSellers(page.items);
      })
      .catch(() => {
        // Nome da loja é só um complemento visual — se essa chamada falhar,
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
      const page = await listAdminOrders({ limit: PAGE_SIZE, cursor });
      setOrders(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setOrders(null);
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar os pedidos.",
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
    if (!hasNextPage || !orders || orders.length === 0) return;
    const nextCursor = orders[orders.length - 1]?.id ?? null;
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

  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader
        title="Pedidos"
        description="Pedidos de todas as lojas, direto do orders-service."
      />

      {isLoading ? (
        <p role="status">Carregando pedidos…</p>
      ) : error ? (
        <AdminEmptyState title="Não foi possível carregar os pedidos" description={error} />
      ) : (
        <AdminDataTable
          caption="Pedidos de todas as lojas"
          rows={orders ?? []}
          columns={[
            { key: "code", header: "Pedido", render: (row) => row.order.orderNumber },
            { key: "seller", header: "Loja", render: (row) => sellerName(row.sellerId) },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <AdminStatusBadge
                  label={SELLER_ORDER_STATUS_LABEL[row.status]}
                  tone={orderTone(row.status)}
                />
              ),
            },
            { key: "total", header: "Total", render: (row) => formatMoney(row.subtotalCents) },
            { key: "date", header: "Data", render: (row) => formatDate(row.createdAt) },
            {
              key: "city",
              header: "Cidade",
              render: (row) =>
                row.order.shippingAddress
                  ? `${row.order.shippingAddress.city}/${row.order.shippingAddress.state}`
                  : "—",
            },
          ]}
          mobileCard={(row) => (
            <>
              <strong>{row.order.orderNumber}</strong>
              <span>{sellerName(row.sellerId)}</span>
              <AdminStatusBadge
                label={SELLER_ORDER_STATUS_LABEL[row.status]}
                tone={orderTone(row.status)}
              />
              <span>
                {formatMoney(row.subtotalCents)} · {formatDate(row.createdAt)}
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
    </div>
  );
}
