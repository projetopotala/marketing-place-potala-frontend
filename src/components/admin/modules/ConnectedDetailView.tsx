"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { listAdminSellers, listAdminProducts, listAdminCustomers, listAdminOrders, listAdminContents, ADMIN_SELLER_STATUS_LABEL, ADMIN_PRODUCT_STATUS_LABEL, ADMIN_CUSTOMER_STATUS_LABEL, ADMIN_CONTENT_STATUS_LABEL, type Paginated } from "@/lib/api/admin";
import { SELLER_ORDER_STATUS_LABEL, ORDER_STATUS_LABEL } from "@/lib/api/orders";
import { formatMoney } from "@/features/admin/utils/currency";
import { AdminPageHeader } from "../shared/AdminPageHeader";
import { sharedStyles as styles } from "../shared/AdminDataTable";
import modules from "./modules.module.css";

type RecordView = { id: string; title: string; fields: Record<string, string | number> };
export type AdminResource = "vendedores" | "produtos" | "clientes" | "pedidos" | "conteudos" | "financeiro";
type PageParams = { limit: number; cursor?: string | null };
async function recordPage(resource: AdminResource, params: PageParams): Promise<Paginated<RecordView>> {
  if (resource === "vendedores") {
    const page = await listAdminSellers(params);
    return { ...page, items: page.items.map(row => ({ id: row.id, title: row.tradeName, fields: { "Razão social": row.legalName, Status: ADMIN_SELLER_STATUS_LABEL[row.status], Email: row.email, Documento: `${row.documentType} ${row.documentNumber}`, Comissão: row.commissionBps == null ? "—" : `${row.commissionBps / 100}%`, Motivo: row.statusReason ?? "—" } })) };
  }
  if (resource === "produtos") {
    const page = await listAdminProducts(params);
    return { ...page, items: page.items.map(row => ({ id: row.id, title: row.title, fields: { Status: ADMIN_PRODUCT_STATUS_LABEL[row.status], Preço: formatMoney(row.priceCents), Vendedor: row.sellerId, Categoria: row.categoryId, Descrição: row.description, Variantes: row.variants.map(variant => `${variant.name} · ${variant.sku} · ${variant.inventory.quantity} un.`).join("; ") } })) };
  }
  if (resource === "clientes") {
    const page = await listAdminCustomers(params);
    return { ...page, items: page.items.map(row => ({ id: row.id, title: row.fullName ?? row.email, fields: { Status: ADMIN_CUSTOMER_STATUS_LABEL[row.status], Email: row.email, Telefone: row.phone ?? "—", Cadastro: new Date(row.createdAt).toLocaleDateString("pt-BR") } })) };
  }
  if (resource === "conteudos") {
    const page = await listAdminContents(params);
    return { ...page, items: page.items.map(row => ({ id: row.id, title: row.title, fields: { Status: ADMIN_CONTENT_STATUS_LABEL[row.status], Instrutor: row.instructor, Categoria: row.category, Preço: formatMoney(row.priceCents), Descrição: row.description, Moderação: row.moderationNote ?? "—" } })) };
  }
  const page = await listAdminOrders(params);
  return { ...page, items: page.items.map(row => ({ id: row.id, title: row.order.orderNumber, fields: { Status: SELLER_ORDER_STATUS_LABEL[row.status], Pagamento: ORDER_STATUS_LABEL[row.order.status], Loja: row.sellerId, Bruto: formatMoney(row.subtotalCents), Comissão: row.financialSnapshot ? formatMoney(row.commissionCents) : "—", "Líquido previsto": row.financialSnapshot ? formatMoney(row.sellerNetCents) : "—", Destinatário: row.order.shippingAddress?.recipient ?? "—", Cidade: row.order.shippingAddress ? `${row.order.shippingAddress.city}/${row.order.shippingAddress.state}` : "—", Itens: (row.items ?? []).map(item => `${item.productTitle} · ${item.quantity} un. · ${formatMoney(item.lineTotalCents)}`).join("; ") } })) };
}

export function ConnectedDetailView({ id, resource }: { id: string; resource: AdminResource }) {
  const [record, setRecord] = useState<RecordView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let cursor: string | null = null;
      const visited = new Set<string>();
      do {
        const page = await recordPage(resource, { limit: 100, cursor });
        if (cancelled) return;
        const found = page.items.find(row => row.id === id);
        if (found) { setRecord(found); return; }
        const next = page.pageInfo.nextCursor;
        if (!page.pageInfo.hasNextPage) return;
        if (!next || visited.has(next)) throw new Error("Não foi possível concluir a consulta. Abra a listagem e tente novamente.");
        visited.add(next);
        cursor = next;
      } while (!cancelled);
    }
    load().catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao consultar o registro."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, resource, revision]);
  return <div className={styles.stack}>
    <AdminPageHeader title={record?.title ?? "Detalhes"} description="Informações atuais do registro" actions={<Link className={styles.btnGhost} href={`/admin/${resource}`}>Voltar à listagem</Link>} />
    {loading ? <p role="status">Carregando registro…</p> : error ? <><p role="alert">{error}</p><button className={styles.btnSecondary} onClick={() => { setLoading(true); setError(""); setRecord(null); setRevision(value => value + 1); }}>Tentar novamente</button></> : !record ? <p role="status">Registro não encontrado.</p> : <section className={styles.panel}><h2 className={styles.panelTitle}>Dados</h2><dl className={modules.kvGrid}>{Object.entries(record.fields).map(([label, value]) => <div key={label}><dt className={modules.kvLabel}>{label}</dt><dd className={modules.kvValue}>{value}</dd></div>)}</dl><p className={styles.subtitle}>Use a listagem para executar as ações disponíveis para este registro.</p></section>}
  </div>;
}
