import { apiFetch } from "./client";

/**
 * Fase B do roadmap "estilo Mercado Livre" (ver roadmap-mercado-livre.md
 * no Claude Project). Client for potala-orders-service's `/public/reviews`
 * (sem sessão, mesmo padrão de catalog-public.ts) e o único endpoint
 * autenticado, `POST /orders/:orderId/items/:itemId/review`.
 */

export interface ReviewResponse {
  id: string;
  orderItemId: string;
  customerId: string;
  sellerId: string;
  productId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface RatingSummaryResponse {
  average: number;
  count: number;
}

export interface PageInfo {
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface Paginated<T> {
  items: T[];
  pageInfo: PageInfo;
}

const EMPTY_REVIEWS_PAGE: Paginated<ReviewResponse> = {
  items: [],
  pageInfo: { hasNextPage: false, nextCursor: null },
};

const EMPTY_RATING_SUMMARY: RatingSummaryResponse = { average: 0, count: 0 };

/**
 * GET /public/reviews?productId=X — sem sessão, paginado por cursor.
 * Degrada pra página vazia em qualquer falha (rede, gateway fora,
 * orders-service frio), mesmo raciocínio de listPublicProducts em
 * catalog-public.ts: uma seção de avaliações na vitrine pública nunca deve
 * derrubar a página inteira do produto.
 */
export async function listProductReviews(
  productId: string,
  params: { limit?: number; cursor?: string | null } = {},
): Promise<Paginated<ReviewResponse>> {
  const query = new URLSearchParams({ productId });
  if (params.limit) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  try {
    const result = await apiFetch<Paginated<ReviewResponse>>(
      `/public/reviews?${query.toString()}`,
    );
    return result ?? EMPTY_REVIEWS_PAGE;
  } catch (err) {
    console.error(
      `[reviews] listProductReviews(${productId}) failed, degrading to empty page:`,
      err,
    );
    return EMPTY_REVIEWS_PAGE;
  }
}

/** GET /public/reviews/products/:id/rating-summary — mesma lógica de degradação acima. */
export async function getProductRatingSummary(
  productId: string,
): Promise<RatingSummaryResponse> {
  try {
    const result = await apiFetch<RatingSummaryResponse>(
      `/public/reviews/products/${encodeURIComponent(productId)}/rating-summary`,
    );
    return result ?? EMPTY_RATING_SUMMARY;
  } catch (err) {
    console.error(
      `[reviews] getProductRatingSummary(${productId}) failed, degrading to zero:`,
      err,
    );
    return EMPTY_RATING_SUMMARY;
  }
}

/**
 * GET /public/reviews/sellers/:id/rating-summary — mesma lógica acima.
 * Sem consumidor ainda: `/vendedor/[slug]` continua 100% sobre dado mock
 * (createAdminSeed, ver o próprio page.tsx da rota) — ligar essa página a
 * dado real é um passo separado, maior, fora do escopo da Fase B. Esta
 * função já fica pronta pra quando isso acontecer.
 */
export async function getSellerRatingSummary(
  sellerId: string,
): Promise<RatingSummaryResponse> {
  try {
    const result = await apiFetch<RatingSummaryResponse>(
      `/public/reviews/sellers/${encodeURIComponent(sellerId)}/rating-summary`,
    );
    return result ?? EMPTY_RATING_SUMMARY;
  } catch (err) {
    console.error(
      `[reviews] getSellerRatingSummary(${sellerId}) failed, degrading to zero:`,
      err,
    );
    return EMPTY_RATING_SUMMARY;
  }
}

export interface CreateReviewInput {
  rating: number;
  comment?: string;
}

/**
 * POST /orders/:orderId/items/:itemId/review — autenticado (CUSTOMER).
 * Ação explícita do cliente: diferente das funções de leitura acima, esta
 * NÃO degrada em silêncio — o formulário precisa saber que falhou (409 se
 * já avaliado, 404 se o item não é do pedido/cliente, etc.) pra mostrar a
 * mensagem certa, mesmo padrão de `checkout()` em orders.ts.
 */
export async function createReview(
  orderId: string,
  itemId: string,
  input: CreateReviewInput,
): Promise<ReviewResponse> {
  const result = await apiFetch<ReviewResponse>(
    `/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/review`,
    { method: "POST", body: JSON.stringify(input) },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}
