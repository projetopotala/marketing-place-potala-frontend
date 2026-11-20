import { ApiError, apiFetch } from "./client";
import type { Product, ProductImage as StorefrontProductImage, ProductReviewItem } from "@/types/marketplace";
import type { RatingSummaryResponse, ReviewResponse } from "./reviews";

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
  itemType?: 'PHYSICAL'|'DIGITAL'|'SERVICE'|'COURSE';
  attributes?: Record<string,string|number|boolean>;
  id: string;
  sellerId: string;
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

/**
 * Investigação do 429/504 em produção (02/10, ver Claude Project): estas
 * três funções rodam em Server Components na Vercel (SSR/RSC), sem
 * AbortController/timeout nenhum antes desta mudança -- um
 * catalog-service/gateway lento ou dormindo (cold start do Render) deixava
 * o `fetch` pendurado até a própria Vercel matar a function em 300s
 * ("Vercel Runtime Timeout Error"), em vez de cair no catch já existente
 * abaixo. 20s dá folga suficiente pra um cold start normal do Render
 * (ainda bem menor que os 300s da Vercel) sem deixar a function inteira
 * travada. Escopo deliberadamente limitado a este arquivo -- não é o
 * timeout global de `apiFetch` (client.ts), não afeta login/checkout/
 * pedidos (auth.ts, orders.ts), que têm seus próprios padrões de retry/
 * timeout (ou a ausência deliberada de um, no caso do POST checkout).
 */
const PUBLIC_CATALOG_TIMEOUT_MS = 20_000;
const PUBLIC_CATALOG_RETRY_DELAY_MS = 500;

function isRetryableCatalogError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504;
}

/**
 * A short retry absorbs a transient cold start or gateway hand-off. A
 * persistent outage is intentionally propagated to the storefront error
 * boundary instead of being misrepresented as an empty catalog.
 */
async function fetchPublicCatalog<T>(path: string): Promise<T | null> {
  const request = () => apiFetch<T>(path, {
    signal: AbortSignal.timeout(PUBLIC_CATALOG_TIMEOUT_MS),
  });

  try {
    return await request();
  } catch (error) {
    if (!isRetryableCatalogError(error)) throw error;
    console.warn("[catalog-public] temporary catalog failure; retrying once:", error);
    await new Promise<void>((resolve) => setTimeout(resolve, PUBLIC_CATALOG_RETRY_DELAY_MS));
    return request();
  }
}

/**
 * GET /public/categories — active categories, no auth.
 *
 * A legitimate 200 with no categories stays an empty list. Network/gateway
 * failures retry once and then reach the storefront error boundary, so an
 * unavailable catalog cannot be mistaken for one that simply has no data.
 */
export async function listPublicCategories(): Promise<PublicCategory[]> {
  return (await fetchPublicCatalog<PublicCategory[]>("/public/categories")) ?? [];
}

export interface ListPublicProductsParams {
  itemType?: string;
  attributes?: string;
  limit?: number;
  cursor?: string | null;
  categoryId?: string;
  sellerId?: string;
  q?: string;
}

const EMPTY_PRODUCTS_PAGE: Paginated<PublicProduct> = {
  items: [],
  pageInfo: { hasNextPage: false, nextCursor: null },
};

/**
 * GET /public/products — ACTIVE products only, cursor-paginated, no auth.
 *
 * Empty responses are legitimate. Connectivity and gateway failures are not:
 * after one retry they are surfaced through the route error boundary.
 */
export async function listPublicProducts(
  params: ListPublicProductsParams = {},
): Promise<Paginated<PublicProduct>> {
  const query = new URLSearchParams();
  if(params.itemType)query.set('itemType',params.itemType);
  if(params.attributes)query.set('attributes',params.attributes);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.sellerId) query.set("sellerId", params.sellerId);
  if (params.q) query.set("q", params.q);
  const qs = query.toString();
  return (await fetchPublicCatalog<Paginated<PublicProduct>>(
    `/public/products${qs ? `?${qs}` : ""}`,
  )) ?? EMPTY_PRODUCTS_PAGE;
}

/**
 * GET /public/products/:id — returns null (not a throw) on a 404, so
 * pages can just call Next's `notFound()` without a try/catch. A
 * DRAFT/INACTIVE product 404s here exactly like a nonexistent id — see
 * catalog-service's ProductsService.getPublishedById.
 *
 * Other failures retry once and then propagate. A temporarily unreachable
 * catalog must not be rendered as a false "product not found" response.
 */
export async function getPublicProduct(id: string): Promise<PublicProduct | null> {
  try {
    return await fetchPublicCatalog<PublicProduct>(`/public/products/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
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
 * Fase B do roadmap "estilo Mercado Livre" — avaliação vem de
 * orders-service (`/public/reviews`, ver lib/api/reviews.ts), não de
 * catalog-service: não há como resolver o nome de quem comprou (só
 * `customerId`, sem endpoint público de identidade, decisão de escopo já
 * registrada no roadmap), então todo item aqui usa um rótulo genérico.
 */
function toReviewItems(reviews: ReviewResponse[]): ProductReviewItem[] {
  return reviews.map((review) => ({
    id: review.id,
    author: "Cliente verificado",
    rating: review.rating,
    date: new Date(review.createdAt).toLocaleDateString("pt-BR"),
    comment: review.comment ?? "",
  }));
}

/**
 * Maps a real catalog-service product onto the storefront's existing
 * `Product` type (types/marketplace.ts) so every already-built
 * presentational component (ProductCard, ProductGallery,
 * ProductInformation, ProductPurchasePanel, ProductReviews,
 * RelatedProducts, …) keeps working completely untouched.
 *
 * `ratingSummary`/`reviews` are optional and come from orders-service
 * (Fase B), a different service than `product` — the caller fetches both
 * in parallel and passes them in here, this function just merges them.
 * Omitting them (existing callers that haven't been updated) falls back
 * to the same "no reviews" defaults as before.
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
export function toStorefrontProduct(
  product: PublicProduct,
  ratingSummary?: RatingSummaryResponse,
  reviews?: ReviewResponse[],
): Product {
  return {
    id: product.id,
    slug: product.id,
    name: product.title,
    characteristics:Object.entries(product.attributes??{}).map(([key,value])=>({label:key.replaceAll('_',' '),value:typeof value==='boolean'?(value?'Sim':'Não'):String(value)})),
    category: product.category.name,
    categoryId: product.category.id,
    price: product.priceCents / 100,
    rating: ratingSummary?.average ?? 0,
    reviewCount: ratingSummary?.count ?? 0,
    imageSrc: toStorefrontImages(product)[0]?.src ?? FALLBACK_IMAGE_SRC,
    imageAlt: product.images[0]?.alt ?? product.title,
    action: "cart",
    featured: product.featured,
    description: product.description || undefined,
    stock: totalStock(product),
    sku: product.variants[0]?.sku,
    images: toStorefrontImages(product),
    defaultVariantId: product.variants[0]?.id,
    reviews: reviews ? toReviewItems(reviews) : undefined,
  };
}
