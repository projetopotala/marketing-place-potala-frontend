import { apiFetch } from "./client";

/**
 * Devoluções -- pedido de Arthur ("vamos seguir em frente"), mesma rodada
 * de Cupons (ver claude/status-migracao-microservicos.md no Claude
 * Project). Client for potala-orders-service's Return endpoints, através
 * do gateway: `POST /orders/:orderId/items/:itemId/return` (cliente),
 * `GET /orders/returns` (cliente, "Solicitações" da própria conta),
 * `GET /admin/returns` + `PATCH /admin/returns/:id/(approve|reject)`
 * (admin, mediador -- ver comentário do model Return no schema.prisma
 * do orders-service pra por que não há reembolso/reposição de estoque
 * automáticos nesta v1).
 */

export type ReturnStatus = "REQUESTED" | "APPROVED" | "REJECTED";

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: "Solicitado",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
};

export interface ReturnResponse {
  id: string;
  orderItemId: string;
  customerId: string;
  sellerId: string;
  productId: string;
  reason: string;
  description: string | null;
  status: ReturnStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Forma de linha das listas (cliente e admin) -- inclui um resumo do
 * OrderItem/pedido pai (`orderItem.select` no returns.service.ts),
 * nunca o objeto completo. `sku` só vem na listagem do admin.
 */
export interface ReturnListItemResponse extends ReturnResponse {
  orderItem: {
    productTitle: string;
    sku?: string;
    sellerOrder: { order: { orderNumber: string } };
  };
}

export interface PageInfo {
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface Paginated<T> {
  items: T[];
  pageInfo: PageInfo;
}

const EMPTY_PAGE: Paginated<ReturnListItemResponse> = {
  items: [],
  pageInfo: { hasNextPage: false, nextCursor: null },
};

export interface CreateReturnInput {
  reason: string;
  description?: string;
}

/**
 * POST /orders/:orderId/items/:itemId/return -- autenticado (CUSTOMER).
 * Ação explícita, mesmo padrão de createReview em reviews.ts: NÃO degrada
 * em silêncio -- 409 se já solicitado para este item, 404 se o item não é
 * deste pedido/cliente, 409 se o SellerOrder ainda não está CONFIRMED
 * (mensagem pronta do backend).
 */
export async function createReturn(
  orderId: string,
  itemId: string,
  input: CreateReturnInput,
): Promise<ReturnResponse> {
  const result = await apiFetch<ReturnResponse>(
    `/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/return`,
    { method: "POST", body: JSON.stringify(input) },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** GET /orders/returns -- solicitações do próprio cliente, paginadas por cursor. */
export async function listMyReturns(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<ReturnListItemResponse>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<ReturnListItemResponse>>(
    `/orders/returns${qs ? `?${qs}` : ""}`,
  );
  return result ?? EMPTY_PAGE;
}

/** GET /admin/returns -- todas as solicitações, de qualquer loja, paginadas por cursor. */
export async function listAdminReturns(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<ReturnListItemResponse>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<ReturnListItemResponse>>(
    `/admin/returns${qs ? `?${qs}` : ""}`,
  );
  return result ?? EMPTY_PAGE;
}

/**
 * PATCH /admin/returns/:id/(approve|reject) -- só sai de REQUESTED (409
 * se já decidido, mensagem pronta do backend). Não processa reembolso nem
 * repõe estoque -- ver comentário do model Return no schema.prisma.
 */
async function decideReturn(id: string, action: "approve" | "reject"): Promise<ReturnResponse> {
  const result = await apiFetch<ReturnResponse>(
    `/admin/returns/${encodeURIComponent(id)}/${action}`,
    { method: "PATCH" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

export function approveReturn(id: string): Promise<ReturnResponse> {
  return decideReturn(id, "approve");
}

export function rejectReturn(id: string): Promise<ReturnResponse> {
  return decideReturn(id, "reject");
}
