"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Truck } from "lucide-react";
import {
  advanceAdminSellerOrder,
  listAdminOrders,
  listAdminSellers,
  type AdminSeller,
  type AdminSellerOrder,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { SELLER_ORDER_STATUS_LABEL, type SellerOrderStatus } from "@/lib/api/orders";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminMetricCard, AdminMetricsRow } from "@/components/admin/shared/AdminMetricCard";
import { AdminDataTable, sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminEmptyState, AdminFilterBar, AdminStatusBadge, Field } from "@/components/admin/shared/AdminStatusBadge";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";

const PAGE_SIZE = 25;

function tone(status: SellerOrderStatus) {
  if (status === "DELIVERED" || status === "SHIPPED") return "success" as const;
  if (status === "PENDING") return "warning" as const;
  if (status === "CANCELLED") return "danger" as const;
  return "info" as const;
}

function date(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

const NEXT_ADMIN_ACTION: Partial<Record<SellerOrderStatus, { action: "prepare" | "ship" | "deliver"; label: string }>> = {
  CONFIRMED: { action: "prepare", label: "Iniciar preparo" },
  PREPARING: { action: "ship", label: "Marcar como enviado" },
  SHIPPED: { action: "deliver", label: "Marcar como entregue" },
};

/** Fulfillment real: não inventa transportadora, rastreio ou previsão de entrega. */
export function DeliveriesView() {
  const toast = useAdminToast();
  const [orders, setOrders] = useState<AdminSellerOrder[] | null>(null);
  const [sellers, setSellers] = useState<AdminSeller[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | SellerOrderStatus>("ALL");
  const [query, setQuery] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const loadPage = useCallback(async (cursor: string | null) => {
    setIsLoading(true);
    setError(null);
    setExpandedOrderId(null);
    setRowErrors({});
    try {
      const [orderPage, sellerPage] = await Promise.all([
        listAdminOrders({ limit: PAGE_SIZE, cursor }),
        listAdminSellers({ limit: 100 }),
      ]);
      setOrders(orderPage.items);
      setSellers(sellerPage.items);
      setHasNextPage(orderPage.pageInfo.hasNextPage);
    } catch (cause) {
      setOrders(null);
      setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar as entregas.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // A carga ocorre depois do commit do efeito; `loadPage` atualiza estados
    // de rede e não deve disparar uma atualização síncrona durante o efeito.
    const timer = window.setTimeout(() => {
      void loadPage(cursorStack[pageIndex] ?? null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cursorStack, loadPage, pageIndex]);

  const sellerName = useMemo(() => new Map(sellers.map((seller) => [seller.id, seller.tradeName])), [sellers]);
  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return (orders ?? []).filter((order) => {
      const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
      const destination = order.order.shippingAddress
        ? `${order.order.shippingAddress.city} ${order.order.shippingAddress.state}`
        : "";
      const matchesQuery = !normalizedQuery || [
        order.order.orderNumber,
        sellerName.get(order.sellerId) ?? order.sellerId,
        destination,
      ].some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
      return matchesStatus && matchesQuery;
    });
  }, [orders, query, sellerName, statusFilter]);
  const inProgress = filteredOrders.filter((order) => ["CONFIRMED", "PREPARING", "SHIPPED"].includes(order.status)).length;
  const delivered = filteredOrders.filter((order) => order.status === "DELIVERED").length;

  function goNext() {
    if (!hasNextPage || !orders?.length) return;
    const cursor = orders[orders.length - 1]?.id ?? null;
    setCursorStack((stack) => [...stack.slice(0, pageIndex + 1), cursor]);
    setPageIndex((current) => current + 1);
  }

  function goPrevious() {
    if (pageIndex > 0) setPageIndex((current) => current - 1);
  }

  async function advance(order: AdminSellerOrder) {
    const next = NEXT_ADMIN_ACTION[order.status];
    if (!next) return;
    setAdvancingId(order.id);
    setRowErrors((current) => {
      const updated = { ...current };
      delete updated[order.id];
      return updated;
    });
    try {
      const updated = await advanceAdminSellerOrder(order.id, next.action);
      setOrders((current) =>
        (current ?? []).map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.push("Entrega atualizada.");
    } catch (cause) {
      const message = cause instanceof ApiError
        ? cause.message
        : "Não foi possível atualizar a entrega.";
      setRowErrors((current) => ({
        ...current,
        [order.id]: message,
      }));
      toast.push(message, "error");
    } finally {
      setAdvancingId(null);
    }
  }

  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader
        title="Entregas"
        description="Acompanhe o fulfillment real dos pedidos em todas as lojas. O avanço de status continua reservado ao vendedor responsável até existir uma operação administrativa auditável."
        actions={<button type="button" className={sharedStyles.btnGhost} onClick={() => void loadPage(cursorStack[pageIndex] ?? null)} disabled={isLoading}>Atualizar</button>}
      />
      {isLoading ? <p role="status">Carregando entregas…</p> : null}
      {error ? <AdminEmptyState title="Não foi possível carregar as entregas" description={error} /> : null}
      {orders ? <>
        <AdminFilterBar>
          <Field label="Buscar nesta página">
            <input aria-label="Buscar entregas nesta página" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pedido, loja ou destino" />
          </Field>
          <Field label="Status">
            <select aria-label="Filtrar entregas por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | SellerOrderStatus)}>
              <option value="ALL">Todos os status</option>
              {Object.entries(SELLER_ORDER_STATUS_LABEL).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
            </select>
          </Field>
        </AdminFilterBar>
        <AdminMetricsRow>
          <AdminMetricCard label="Em andamento" value={String(inProgress)} hint="Na página filtrada" icon={Truck} />
          <AdminMetricCard label="Entregues" value={String(delivered)} hint="Na página filtrada" icon={Truck} />
        </AdminMetricsRow>
        <AdminDataTable
          caption="Fulfillment por pedido na página atual"
          rows={filteredOrders}
          columns={[
            { key: "order", header: "Pedido", render: (row) => row.order.orderNumber },
            { key: "seller", header: "Loja", render: (row) => sellerName.get(row.sellerId) ?? row.sellerId },
            { key: "status", header: "Status", render: (row) => <AdminStatusBadge label={SELLER_ORDER_STATUS_LABEL[row.status]} tone={tone(row.status)} /> },
            { key: "city", header: "Destino", render: (row) => row.order.shippingAddress ? `${row.order.shippingAddress.city}/${row.order.shippingAddress.state}` : "—" },
            { key: "date", header: "Data", render: (row) => date(row.createdAt) },
            {
              key: "details",
              header: "Detalhes",
              render: (row) => {
                const next = NEXT_ADMIN_ACTION[row.status];
                return (
                  <div className={sharedStyles.rowActions}>
                    <button
                      type="button"
                      className={sharedStyles.btnGhost}
                      aria-expanded={expandedOrderId === row.id}
                      onClick={() => setExpandedOrderId((current) => current === row.id ? null : row.id)}
                    >
                      {expandedOrderId === row.id ? "Ocultar" : "Ver detalhes"}
                    </button>
                    {next ? (
                      <button
                        type="button"
                        className={sharedStyles.btnSecondary}
                        disabled={advancingId === row.id}
                        onClick={() => void advance(row)}
                      >
                        {advancingId === row.id ? "Atualizando…" : next.label}
                      </button>
                    ) : null}
                    {rowErrors[row.id] ? <span role="alert">{rowErrors[row.id]}</span> : null}
                  </div>
                );
              },
            },
          ]}
          mobileCard={(row) => {
            const next = NEXT_ADMIN_ACTION[row.status];
            return (
              <>
                <strong>{row.order.orderNumber}</strong>
                <span>{sellerName.get(row.sellerId) ?? row.sellerId}</span>
                <AdminStatusBadge label={SELLER_ORDER_STATUS_LABEL[row.status]} tone={tone(row.status)} />
                <span>{date(row.createdAt)}</span>
                <button
                  type="button"
                  className={sharedStyles.btnGhost}
                  aria-expanded={expandedOrderId === row.id}
                  onClick={() => setExpandedOrderId((current) => current === row.id ? null : row.id)}
                >
                  {expandedOrderId === row.id ? "Ocultar detalhes" : "Ver detalhes"}
                </button>
                {next ? (
                  <button
                    type="button"
                    className={sharedStyles.btnSecondary}
                    disabled={advancingId === row.id}
                    onClick={() => void advance(row)}
                  >
                    {advancingId === row.id ? "Atualizando…" : next.label}
                  </button>
                ) : null}
                {rowErrors[row.id] ? <span role="alert">{rowErrors[row.id]}</span> : null}
              </>
            );
          }}
        />
        {expandedOrderId ? (() => {
          const order = filteredOrders.find((item) => item.id === expandedOrderId);
          if (!order) return null;
          const address = order.order.shippingAddress;
          return <section className={sharedStyles.panel} aria-label={`Detalhes do pedido ${order.order.orderNumber}`}>
            <h2 className={sharedStyles.panelTitle}>Pedido {order.order.orderNumber}</h2>
            <p><strong>Loja:</strong> {sellerName.get(order.sellerId) ?? order.sellerId}</p>
            <p><strong>Destino:</strong> {address ? `${address.recipient}, ${address.street}, ${address.number} — ${address.city}/${address.state}` : "Endereço indisponível"}</p>
            <p><strong>Itens:</strong> {order.items.length ? order.items.map((item) => `${item.quantity}× ${item.productTitle}`).join(", ") : "Nenhum item retornado pela API."}</p>
            <p><strong>Valores:</strong> itens {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.subtotalCents / 100)} · frete {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.shippingCents / 100)}</p>
          </section>;
        })() : null}
        <div className={sharedStyles.rowActions}>
          <button type="button" className={sharedStyles.btnGhost} disabled={pageIndex === 0 || isLoading} onClick={goPrevious}>Anterior</button>
          <span>Página {pageIndex + 1}</span>
          <button type="button" className={sharedStyles.btnGhost} disabled={!hasNextPage || isLoading} onClick={goNext}>Próxima</button>
        </div>
      </> : null}
      <p>Transportadora, código de rastreio e previsão de entrega não são expostos pelo backend atual. A confirmação de pagamento continua exclusiva do fluxo financeiro.</p>
    </div>
  );
}
