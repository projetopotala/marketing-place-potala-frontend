import { apiFetch } from "./client";

/** Mirrors catalog-service's Prisma ProductStatus enum (prisma/schema.prisma). */
export type SellerProductStatus =
  | "DRAFT"
  | "REVIEW"
  | "ACTIVE"
  | "REJECTED"
  | "INACTIVE";

export const SELLER_PRODUCT_STATUS_LABEL: Record<SellerProductStatus, string> = {
  DRAFT: "Rascunho",
  REVIEW: "Em revisão",
  ACTIVE: "Ativo",
  REJECTED: "Rejeitado",
  INACTIVE: "Inativo",
};

/** Mirrors catalog-service's Inventory model — never null in practice (every variant is created with one), but the relation is optional in Prisma. */
export interface SellerProductInventory {
  quantity: number;
  reservedQuantity: number;
}

/** Mirrors catalog-service's ProductVariant model as returned by GET /seller/products(/:id). */
export interface SellerProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  /** Overrides the product's priceCents when set; null means "use the product's own price". */
  priceCents: number | null;
  active: boolean;
  inventory: SellerProductInventory | null;
}

/** Mirrors catalog-service's Product model as returned by GET /seller/products(/:id). */
export interface SellerProduct {
  id: string;
  sellerId: string;
  categoryId: string;
  title: string;
  slug: string;
  description: string;
  priceCents: number;
  status: SellerProductStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  variants: SellerProductVariant[];
}

export interface PageInfo {
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface Paginated<T> {
  items: T[];
  pageInfo: PageInfo;
}

/** Sum of on-hand quantity across every variant — the backend has no single "product stock" field (stock is tracked per variant). */
export function totalStock(product: SellerProduct): number {
  return product.variants.reduce(
    (sum, variant) => sum + (variant.inventory?.quantity ?? 0),
    0,
  );
}

/**
 * GET /seller/products — cursor-paginated, ACTIVE sellers only (a PENDING
 * store gets 403 from catalog-service's own SellerActiveGuard; the UI is
 * expected to gate on Session.sellerCanOperate before ever calling this).
 * No search or status filter exists server-side — PaginationQueryDto only
 * takes limit/cursor.
 */
export async function listSellerProducts(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<SellerProduct>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<SellerProduct>>(
    `/seller/products${qs ? `?${qs}` : ""}`,
  );
  return result ?? { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
}

/** GET /seller/products/:id — 404s (not 403) for a product that exists but belongs to another store, so a missing product and a foreign one look identical here, same as the backend intends. */
export async function getSellerProduct(id: string): Promise<SellerProduct> {
  const result = await apiFetch<SellerProduct>(
    `/seller/products/${encodeURIComponent(id)}`,
  );
  if (!result) {
    throw new Error("Produto não encontrado.");
  }
  return result;
}
