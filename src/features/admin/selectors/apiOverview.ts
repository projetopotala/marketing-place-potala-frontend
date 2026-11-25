import type { AdminCategory, AdminProduct, AdminSellerOrder } from "@/lib/api/admin";

const paidStatuses = new Set(["PAID", "FULFILLING", "COMPLETED"]);
export const isPaidOrder = (row: AdminSellerOrder) => paidStatuses.has(row.order.status);

// Use the marketplace timezone consistently, including when the browser is abroad.
const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export function buildApiOverview(orders: AdminSellerOrder[], products: AdminProduct[], categories: AdminCategory[], days: number, now = new Date()) {
  const end = dayKey(now);
  const start = dayKey(new Date(now.getTime() - (days - 1) * 86400000));
  const periodOrders = orders.filter(row => {
    const date = dayKey(new Date(row.createdAt));
    return date >= start && date <= end;
  });
  const paid = periodOrders.filter(isPaidOrder);
  const productMap = new Map(products.map(product => [product.id, product]));
  const categoryMap = new Map(categories.map(category => [category.id, category.name]));
  const categoryTotals = new Map<string, { id: string; label: string; value: number }>();
  const productTotals = new Map<string, { id: string; title: string; quantity: number; revenueCents: number }>();
  for (const row of paid) {
    for (const item of row.items ?? []) {
      const categoryId = productMap.get(item.productId)?.categoryId ?? "unknown";
      const category = categoryTotals.get(categoryId) ?? { id: categoryId, label: categoryMap.get(categoryId) ?? "Categoria não informada", value: 0 };
      category.value += item.lineTotalCents;
      categoryTotals.set(categoryId, category);
      const product = productTotals.get(item.productId) ?? { id: item.productId, title: item.productTitle, quantity: 0, revenueCents: 0 };
      product.quantity += item.quantity;
      product.revenueCents += item.lineTotalCents;
      productTotals.set(item.productId, product);
    }
  }
  const sales = Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getTime() - (days - index - 1) * 86400000);
    const key = dayKey(date);
    const rows = paid.filter(row => dayKey(new Date(row.createdAt)) === key);
    return { label: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(date), orders: new Set(rows.map(row => row.orderId)).size, revenueCents: rows.reduce((sum, row) => sum + row.subtotalCents, 0) };
  });
  const allSnapshots = paid.every(row => row.financialSnapshot != null);
  return {
    orderCount: new Set(periodOrders.map(row => row.orderId)).size,
    todayCount: new Set(orders.filter(row => dayKey(new Date(row.createdAt)) === end).map(row => row.orderId)).size,
    paidCents: paid.reduce((sum, row) => sum + row.subtotalCents, 0),
    pendingCents: periodOrders.filter(row => row.order.status === "PENDING_PAYMENT").reduce((sum, row) => sum + row.subtotalCents, 0),
    commissionCents: allSnapshots ? paid.reduce((sum, row) => sum + row.commissionCents, 0) : null,
    netCents: allSnapshots ? paid.reduce((sum, row) => sum + row.sellerNetCents, 0) : null,
    shipments: periodOrders.filter(row => ["CONFIRMED", "PREPARING", "SHIPPED"].includes(row.status)).length,
    sales,
    categories: [...categoryTotals.values()],
    topProducts: [...productTotals.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 5),
    recent: [...periodOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    sellerTotals: [...new Set(paid.map(row => row.sellerId))].map(id => ({ id, value: paid.filter(row => row.sellerId === id).reduce((sum, row) => sum + row.subtotalCents, 0) })).sort((a, b) => b.value - a.value).slice(0, 5),
  };
}
