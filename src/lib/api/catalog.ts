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

/** Mirrors catalog-service's ProductImage model. Only present on GET /seller/products/:id (detail) — the list endpoint does not include it. */
export interface SellerProductImage {
  id: string;
  url: string;
  alt: string | null;
  position: number;
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
  /** Only populated by getSellerProduct — listSellerProducts does not include images. */
  images?: SellerProductImage[];
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

/** Mirrors catalog-service's Category model, trimmed to the fields SellerCategoriesController.listActive() returns. */
export interface SellerCategory {
  id: string;
  name: string;
  slug: string;
}

/**
 * GET /seller/categories — new endpoint (catalog-service), added to unblock
 * this form: lists ACTIVE categories only, ACTIVE sellers only (same guard
 * pair as /seller/products). No pagination — this is a short reference
 * list, not user content.
 */
export async function listSellerCategories(): Promise<SellerCategory[]> {
  const result = await apiFetch<SellerCategory[]>("/seller/categories");
  return result ?? [];
}

/**
 * Every product created through this form gets exactly one variant, named
 * "Padrão" (the same default catalog-service itself falls back to
 * elsewhere) — CreateProductDto requires at least one variant with its own
 * sku/quantity, but this screen deliberately doesn't expose multi-variant
 * creation (e.g. size/color) yet; see status doc for the scope decision.
 */
const DEFAULT_VARIANT_NAME = "Padrão";

export interface CreateSellerProductInput {
  title: string;
  description?: string;
  categoryId: string;
  priceCents: number;
  sku: string;
  quantity: number;
  /** URLs already hosted elsewhere by the seller — mirrors CreateProductDto.imageUrls (catalog-service); max 6, see MAX_PRODUCT_IMAGE_URLS. */
  imageUrls?: string[];
}

/** POST /seller/products — ACTIVE sellers only. Mirrors CreateProductDto exactly, with a single implicit variant built from sku/quantity. */
export async function createSellerProduct(
  input: CreateSellerProductInput,
): Promise<SellerProduct> {
  const result = await apiFetch<SellerProduct>("/seller/products", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      description: input.description?.trim() ? input.description.trim() : undefined,
      categoryId: input.categoryId,
      priceCents: input.priceCents,
      variants: [
        {
          name: DEFAULT_VARIANT_NAME,
          sku: input.sku,
          quantity: input.quantity,
        },
      ],
      imageUrls: input.imageUrls && input.imageUrls.length > 0 ? input.imageUrls : undefined,
    }),
  });
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/**
 * PATCH /seller/products/:id — publica (DRAFT/INACTIVE -> ACTIVE) ou
 * despublica (-> INACTIVE) um produto da própria loja. Mirrors
 * UpdateProductStatusDto (catalog-service): só ACTIVE/INACTIVE são aceitos
 * aqui, REVIEW/REJECTED implicam um fluxo de moderação que não existe
 * ainda. 404 (não 403) se o produto for de outra loja — mesmo padrão de
 * "404 indistinguível" do resto da API.
 */
export async function updateSellerProductStatus(
  id: string,
  status: Extract<SellerProductStatus, "ACTIVE" | "INACTIVE">,
): Promise<SellerProduct> {
  const result = await apiFetch<SellerProduct>(
    `/seller/products/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}
