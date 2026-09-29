import { apiFetch } from "./client";

/**
 * Lista de desejos do cliente -- novo nesta sessão (ver
 * status-migracao-microservicos.md, "Favoritos/config/endereços do
 * cliente"). Client for potala-orders-service's `/orders/favorites`
 * (autenticado, Role.CUSTOMER). Sem snapshot de produto aqui: cada
 * favorito só guarda `productId` -- nome/imagem/preço são resolvidos à
 * parte via `getPublicProduct` (catalog-public.ts), um por item, na tela
 * dedicada (/minha-conta/favoritos). `ProductCard` (usado em toda a
 * vitrine) só precisa do conjunto de productIds pra saber "é favorito ou
 * não" -- ver AccountDataContext.tsx, único consumidor direto deste
 * client.
 */

export interface FavoriteResponse {
  id: string;
  customerId: string;
  productId: string;
  createdAt: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface Paginated<T> {
  items: T[];
  pageInfo: PageInfo;
}

const EMPTY_FAVORITES_PAGE: Paginated<FavoriteResponse> = {
  items: [],
  pageInfo: { hasNextPage: false, nextCursor: null },
};

/**
 * GET /orders/favorites — autenticado, não degrada em silêncio (mesmo
 * padrão de listMyReviews em reviews.ts): quem chama decide o que fazer
 * com a falha (AccountDataContext degrada pra lista vazia no catch do seu
 * próprio useEffect).
 */
export async function listMyFavorites(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<FavoriteResponse>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<FavoriteResponse>>(
    `/orders/favorites${qs ? `?${qs}` : ""}`,
  );
  return result ?? EMPTY_FAVORITES_PAGE;
}

/** POST /orders/favorites — idempotente no backend (favoritar de novo não é erro). */
export async function addFavorite(productId: string): Promise<FavoriteResponse> {
  const result = await apiFetch<FavoriteResponse>("/orders/favorites", {
    method: "POST",
    body: JSON.stringify({ productId }),
  });
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** DELETE /orders/favorites/:productId — idempotente no backend (204 mesmo se já não existia). */
export async function removeFavorite(productId: string): Promise<void> {
  await apiFetch<null>(`/orders/favorites/${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });
}
