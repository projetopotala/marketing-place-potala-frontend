"use client";

import { useEffect, useMemo, useState } from "react";
import { Truck } from "lucide-react";
import { listAdminOrders, listAdminSellers, type AdminSeller, type AdminSellerOrder } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { SELLER_ORDER_STATUS_LABEL, type SellerOrderStatus } from "@/lib/api/orders";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminMetricCard, AdminMetricsRow } from "@/components/admin/shared/AdminMetricCard";
import { AdminDataTable, sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminEmptyState, AdminStatusBadge } from "@/components/admin/shared/AdminStatusBadge";

const LIMIT = 100;

function tone(status: SellerOrderStatus) {
  if (status === "DELIVERED" || status === "SHIPPED") return "success" as const;
  if (status === "PENDING") return "warning" as const;
  if (status === "CANCELLED") return "danger" as const;
  return "info" as const;
}

function date(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

/** Fulfillment real: não inventa transportadora, rastreio ou previsão de entrega. */
export function DeliveriesView() {
  const [orders, setOrders] = useState<AdminSellerOrder[] | null>(null);
  const [sellers, setSellers] = useState<AdminSeller[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([listAdminOrders({ limit: LIMIT }), listAdminSellers({ limit: LIMIT })])
        .then(([orderPage, sellerPage]) => {
          setOrders(orderPage.items);
          setSellers(sellerPage.items);
        })
        .catch((cause) => {
          setOrders(null);
          setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar as entregas.");
        });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const sellerName = useMemo(() => new Map(sellers.map((seller) => [seller.id, seller.tradeName])), [sellers]);
  const inProgress = orders?.filter((order) => ["CONFIRMED", "PREPARING", "SHIPPED"].includes(order.status)).length ?? 0;
  const delivered = orders?.filter((order) => order.status === "DELIVERED").length ?? 0;

  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader title="Entregas" description={`Status de fulfillment na amostra de até ${LIMIT} linhas de pedido mais recentes.`} />
      {orders === null && !error ? <p role="status">Carregando entregas…</p> : null}
      {error ? <AdminEmptyState title="Não foi possível carregar as entregas" description={error} /> : null}
      {orders ? <>
        <AdminMetricsRow>
          <AdminMetricCard label="Em andamento" value={String(inProgress)} hint="Na amostra atual" icon={Truck} />
          <AdminMetricCard label="Entregues" value={String(delivered)} hint="Na amostra atual" icon={Truck} />
        </AdminMetricsRow>
        <AdminDataTable
          caption="Fulfillment por pedido"
          rows={orders}
          columns={[
            { key: "order", header: "Pedido", render: (row) => row.order.orderNumber },
            { key: "seller", header: "Loja", render: (row) => sellerName.get(row.sellerId) ?? row.sellerId },
            { key: "status", header: "Status", render: (row) => <AdminStatusBadge label={SELLER_ORDER_STATUS_LABEL[row.status]} tone={tone(row.status)} /> },
            { key: "city", header: "Destino", render: (row) => row.order.shippingAddress ? `${row.order.shippingAddress.city}/${row.order.shippingAddress.state}` : "—" },
            { key: "date", header: "Data", render: (row) => date(row.createdAt) },
          ]}
          mobileCard={(row) => <><strong>{row.order.orderNumber}</strong><span>{sellerName.get(row.sellerId) ?? row.sellerId}</span><AdminStatusBadge label={SELLER_ORDER_STATUS_LABEL[row.status]} tone={tone(row.status)} /><span>{date(row.createdAt)}</span></>}
        />
      </> : null}
      <p>Transportadora, código de rastreio e previsão de entrega não são expostos pelo backend atual.</p>
    </div>
  );
}
