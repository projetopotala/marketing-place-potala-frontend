import { apiFetch } from "./client";
import type { Product, ProductImage as StorefrontProductImage } from "@/types/marketplace";

/**
 * New this session — Fase 1 do plano até 05/10 (vitrine pública real,
 * ver status-migracao-microservicos.md no Claude Project). Client for
 * catalog-service's new, unauthenticated `/public/*` endpoints. Unlike
 * everything else in `src/lib/api/`, none of this needs a session — these
 * are the only endpoints in the whole system meant to be called by an
 * anonymous shopper.
 */

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
}

export interface PublicProductImage {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}

export interface PublicProductVariant {
  id: string;
  sku: string;
  name: string;
  priceCents: number | null;
  active: boolean;
  inventory: { quantity: number; reservedQuantity: number } | null;
}

/** Mirrors catalog-service's Product model as returned by GET /public/products(/:id) — ACTIVE only, every field the backend actually has (no rating/reviews/seller — those don't exist in this backend, see the mapper below). */
export interface PublicProduct {
  id: string;
  title: string;
  slug: string;
  description: string;
  priceCents: number;
  featured: boolean;
  createdAt: string;
  category: { id: string; name: string; slug: string };
  images: PublicProductImage[];
  variants: PublicProductVariant[];
}

export interface PageInfo {
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface Paginated<T> {
  items: T[];
  pageInfo: PageInfo;
}

/** GET /public/categories — active categories, no auth. */
export async function listPublicCategories(): Promise<PublicCategory[]> {
  const result = await apiFetch<PublicCategory[]>("/public/categories");
  return result ?? [];
}

export interface ListPublicProductsParams {
  limit?: number;
  cursor?: string | null;
  categoryId?: string;
  q?: string;
}

/** GET /public/products — ACTIVE products only, cursor-paginated, no auth. */
export async function listPublicProducts(
  params: ListPublicProductsParams = {},
): Promise<Paginated<PublicProduct>> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.q) query.set("q", params.q);
  const qs = query.toString();
  const result = await apiFetch<Paginated<PublicProduct>>(
    `/public/products${qs ? `?${qs}` : ""}`,
  );
  return result ?? { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
}

/**
 * GET /public/products/:id — returns null (not a throw) on a 404, so
 * pages can just call Next's `notFound()` without a try/catch. A
 * DRAFT/INACTIVE product 404s here exactly like a nonexistent id — see
 * catalog-service's ProductsService.getPublishedById.
 */
export async function getPublicProduct(id: string): Promise<PublicProduct | null> {
  try {
    return await apiFetch<PublicProduct>(`/public/products/${encodeURIComponent(id)}`);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404 || status === 400) {
      return null;
    }
    throw err;
  }
}

export function totalStock(product: PublicProduct): number {
  return product.variants.reduce(
    (sum, variant) => sum + (variant.inventory?.quantity ?? 0),
    0,
  );
}

/**
 * No image on a product falls back to the brand mark — there is no
 * upload endpoint yet (sellers paste image URLs at creation time, see
 * catalog-service's products.constants.ts), so plenty of real products
 * will have zero images for a while.
 */
const FALLBACK_IMAGE_SRC = "/images/potala/logo-mark.png";

function toStorefrontImages(product: PublicProduct): StorefrontProductImage[] {
  if (product.images.length === 0) {
    return [{ src: FALLBACK_IMAGE_SRC, alt: product.title }];
  }
  return product.images
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((image) => ({ src: image.url, alt: image.alt ?? product.title }));
}

/**
 * Maps a real catalog-service product onto the storefront's existing
 * `Product` type (types/marketplace.ts) so every already-built
 * presentational component (ProductCard, ProductGallery,
 * ProductInformation, ProductPurchasePanel, ProductReviews,
 * RelatedProducts, …) keeps working completely untouched.
 *
 * Deliberate simplifications, because these concepts simply do not exist
 * in the real backend yet (nothing here is faked as if it were real data —
 * every field below is either a genuine value or a safe, honest default
 * that the same components already know how to render as "no data"):
 * - `slug` is set to the product's `id`, not its real slug. Product slugs
 *   are only unique per seller (`@@unique([sellerId, slug])`, see
 *   catalog-service/prisma/schema.prisma), not globally — so they cannot
 *   safely identify a product on their own in a single public URL. Every
 *   consumer of `Product.slug` in this codebase only ever uses it to build
 *   a URL (`/produto/${product.slug}`), never displays it, so this is
 *   invisible to the shopper.
 * - `rating`/`reviewCount` are always 0 — there is no review model
 *   anywhere in the backend. ProductCard/ProductInformation already
 *   render "Sem avaliações" for that case, unchanged.
 * - `stock` is the sum of on-hand quantity across every variant — the
 *   backend has no single "product stock" field either (same convention
 *   already used by `totalStock` in lib/api/catalog.ts for the seller
 *   panel).
 * - No `seller` block: the public product endpoint does not resolve the
 *   seller's store name (would need a network call to sellers-service;
 *   deferred, see the plan doc).
 * - No `originalPrice`/`badge`/`isNew`/`characteristics`/`shippingSummary`
 *   — none of these exist on Product in catalog-service. Every consumer
 *   already treats them as optional and renders nothing when absent.
 */
export function toStorefrontProduct(product: PublicProduct): Product {
  return {
    id: product.id,
    slug: product.id,
    name: product.title,
    category: product.category.name,
    categoryId: product.category.id,
    price: product.priceCents / 100,
    rating: 0,
    reviewCount: 0,
    imageSrc: toStorefrontImages(product)[0]?.src ?? FALLBACK_IMAGE_SRC,
    imageAlt: product.images[0]?.alt ?? product.title,
    action: "cart",
    featured: product.featured,
    description: product.description || undefined,
    stock: totalStock(product),
    sku: product.variants[0]?.sku,
    images: toStorefrontImages(product),
    defaultVariantId: product.variants[0]?.id,
  };
}
