import { apiFetch } from "./client";
import type { DisputeSummary } from "./disputes";

/**
 * Reclamações (pós-venda) -- client for potala-orders-service's Claim
 * endpoints, através do gateway:
 * `POST /orders/:orderId/items/:itemId/claim` + `GET/POST/PATCH
 * /orders/claims/...` (CUSTOMER), `GET/POST /seller/claims/...` (SELLER,
 * sem nenhuma transição manual de status -- ver abaixo), `GET/POST/PATCH
 * /admin/claims/...` (ADMIN). Abrir uma Dispute a partir de uma Claim
 * (`POST .../claims/:id/dispute`) mora em disputes.ts, não aqui.
 *
 * SELLER NÃO TEM NENHUMA FUNÇÃO DE TRANSIÇÃO MANUAL DE STATUS (resolve/
 * cancel/escalate/close) NESTE CLIENT -- de propósito, espelhando
 * `CLAIM_ROLE_TARGETS[Role.SELLER] = []` no backend (claims.service.ts):
 * não existem rotas seller/claims/:id/(resolve|cancel|escalate|close) no
 * backend, e não devem ser inventadas aqui. A única forma de o vendedor
 * fazer uma Claim avançar é respondendo (addMySellerClaimMessage), que
 * move automaticamente para CUSTOMER_RESPONSE_REQUIRED no backend.
 */

export type ClaimStatus =
  | "OPEN"
  | "SELLER_RESPONSE_REQUIRED"
  | "CUSTOMER_RESPONSE_REQUIRED"
  | "RESOLVED"
  | "ESCALATED"
  | "CLOSED"
  | "CANCELLED";

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  OPEN: "Aberta",
  SELLER_RESPONSE_REQUIRED: "Aguardando o vendedor",
  CUSTOMER_RESPONSE_REQUIRED: "Aguardando o cliente",
  RESOLVED: "Resolvida",
  ESCALATED: "Escalada",
  CLOSED: "Encerrada",
  CANCELLED: "Cancelada",
};

export type ClaimAuthorRole = "CUSTOMER" | "SELLER" | "ADMIN";

/**
 * Forma crua de uma Claim -- sem `messages`/`evidence`/`dispute`. É o que
 * `createClaim` e toda transição de status (resolve/cancel/escalate/close)
 * devolvem (`claims.service.ts`: `create`/`findUnique`, sempre sem
 * include), e também a forma de cada linha das listagens (`listForX` é um
 * `findMany` cru, sem include nenhum -- nenhuma lista de Claim traz
 * `productTitle`/`orderNumber`/mensagens hoje, diferente de Return).
 */
export interface ClaimResponse {
  id: string;
  orderId: string;
  sellerOrderId: string;
  orderItemId: string;
  customerId: string;
  sellerId: string;
  reason: string;
  description: string | null;
  status: ClaimStatus;
  returnId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

/**
 * Uma mensagem da conversa -- é o que `addMyClaimMessage`/
 * `addMySellerClaimMessage`/`addAdminClaimMessage` realmente devolvem
 * (`tx.claimMessage.create`, a ClaimMessage criada, NUNCA a Claim).
 */
export interface ClaimMessageResponse {
  id: string;
  claimId: string;
  authorUserId: string;
  authorRole: ClaimAuthorRole;
  body: string;
  createdAt: string;
}

/**
 * Metadados de um arquivo anexado -- é o que `addMyClaimEvidence`/
 * `addMySellerClaimEvidence`/`addAdminClaimEvidence` realmente devolvem
 * (`tx.claimEvidence.create`, a ClaimEvidence criada, NUNCA a Claim).
 * Metadata only -- não existe upload real nesta rodada (sem integração de
 * armazenamento no backend ainda); `storageKey` é só a chave que uma etapa
 * futura de upload já teria produzido, nunca um arquivo/base64.
 */
export interface ClaimEvidenceResponse {
  id: string;
  claimId: string;
  uploadedByUserId: string;
  uploadedByRole: ClaimAuthorRole;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

/**
 * Detalhe de uma Claim -- GET .../claims/:id (CUSTOMER/SELLER/ADMIN,
 * `ClaimsService.getForCustomer/getForSeller/getForAdmin`: `include:
 * {messages, evidence, dispute: {select: {...}}}`). `dispute` é o resumo
 * menor de disputes.ts (`DisputeSummary`), nunca o objeto completo, e é
 * `null` enquanto não houver disputa aberta a partir desta Claim.
 */
export interface ClaimDetailResponse extends ClaimResponse {
  messages: ClaimMessageResponse[];
  evidence: ClaimEvidenceResponse[];
  dispute: DisputeSummary | null;
}

export interface PageInfo {
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface Paginated<T> {
  items: T[];
  pageInfo: PageInfo;
}

const EMPTY_PAGE: Paginated<ClaimResponse> = {
  items: [],
  pageInfo: { hasNextPage: false, nextCursor: null },
};

export interface CreateClaimInput {
  reason: string;
  description?: string;
}

export interface AddClaimEvidenceInput {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// CUSTOMER
// ---------------------------------------------------------------------------

/**
 * POST /orders/:orderId/items/:itemId/claim -- abre uma reclamação sobre um
 * item do próprio pedido. 404 se o item não pertencer a este pedido/cliente;
 * 409 se o SellerOrder ainda não estiver num status elegível (CONFIRMED,
 * PREPARING, SHIPPED ou DELIVERED -- NÃO exige DELIVERED, diferente de
 * devolução/avaliação; ver `CLAIM_ELIGIBLE_SELLER_ORDER_STATUSES` no
 * backend).
 */
export async function createClaim(
  orderId: string,
  itemId: string,
  input: CreateClaimInput,
): Promise<ClaimResponse> {
  const result = await apiFetch<ClaimResponse>(
    `/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/claim`,
    { method: "POST", body: JSON.stringify(input) },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** GET /orders/claims -- reclamações do próprio cliente, paginadas por cursor. */
export async function listMyClaims(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<ClaimResponse>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<ClaimResponse>>(
    `/orders/claims${qs ? `?${qs}` : ""}`,
  );
  return result ?? EMPTY_PAGE;
}

/** GET /orders/claims/:id -- detalhe (mensagens, evidências, resumo de disputa) de uma reclamação própria. */
export async function getMyClaim(id: string): Promise<ClaimDetailResponse> {
  const result = await apiFetch<ClaimDetailResponse>(
    `/orders/claims/${encodeURIComponent(id)}`,
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** POST /orders/claims/:id/messages -- envia mensagem numa reclamação própria. 409 se a reclamação não estiver mais aberta para novas mensagens. */
export async function addMyClaimMessage(
  claimId: string,
  body: string,
): Promise<ClaimMessageResponse> {
  const result = await apiFetch<ClaimMessageResponse>(
    `/orders/claims/${encodeURIComponent(claimId)}/messages`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** POST /orders/claims/:id/evidence -- anexa metadados de evidência a uma reclamação própria (metadata only). */
export async function addMyClaimEvidence(
  claimId: string,
  input: AddClaimEvidenceInput,
): Promise<ClaimEvidenceResponse> {
  const result = await apiFetch<ClaimEvidenceResponse>(
    `/orders/claims/${encodeURIComponent(claimId)}/evidence`,
    { method: "POST", body: JSON.stringify(input) },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** PATCH /orders/claims/:id/resolve -- cliente marca a própria reclamação como resolvida. */
export async function resolveMyClaim(id: string): Promise<ClaimResponse> {
  const result = await apiFetch<ClaimResponse>(
    `/orders/claims/${encodeURIComponent(id)}/resolve`,
    { method: "PATCH" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** PATCH /orders/claims/:id/cancel -- cliente cancela a própria reclamação. */
export async function cancelMyClaim(id: string): Promise<ClaimResponse> {
  const result = await apiFetch<ClaimResponse>(
    `/orders/claims/${encodeURIComponent(id)}/cancel`,
    { method: "PATCH" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

// ---------------------------------------------------------------------------
// SELLER -- sem nenhuma transição manual de status, ver comentário no topo
// do arquivo. Responder (mensagem/evidência) é a única ação disponível.
// ---------------------------------------------------------------------------

/** GET /seller/claims -- reclamações recebidas pela própria loja, paginadas por cursor. */
export async function listMySellerClaims(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<ClaimResponse>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<ClaimResponse>>(
    `/seller/claims${qs ? `?${qs}` : ""}`,
  );
  return result ?? EMPTY_PAGE;
}

/** GET /seller/claims/:id -- detalhe de uma reclamação recebida pela própria loja. */
export async function getMySellerClaim(id: string): Promise<ClaimDetailResponse> {
  const result = await apiFetch<ClaimDetailResponse>(
    `/seller/claims/${encodeURIComponent(id)}`,
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/**
 * POST /seller/claims/:id/messages -- vendedor responde a uma reclamação.
 * Move automaticamente a Claim para CUSTOMER_RESPONSE_REQUIRED no backend
 * (nenhuma chamada adicional é necessária ou possível para isso).
 */
export async function addMySellerClaimMessage(
  claimId: string,
  body: string,
): Promise<ClaimMessageResponse> {
  const result = await apiFetch<ClaimMessageResponse>(
    `/seller/claims/${encodeURIComponent(claimId)}/messages`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** POST /seller/claims/:id/evidence -- vendedor anexa metadados de evidência a uma reclamação recebida (metadata only). */
export async function addMySellerClaimEvidence(
  claimId: string,
  input: AddClaimEvidenceInput,
): Promise<ClaimEvidenceResponse> {
  const result = await apiFetch<ClaimEvidenceResponse>(
    `/seller/claims/${encodeURIComponent(claimId)}/evidence`,
    { method: "POST", body: JSON.stringify(input) },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------

/** GET /admin/claims -- todas as reclamações do marketplace, paginadas por cursor. */
export async function listAdminClaims(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<ClaimResponse>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<ClaimResponse>>(
    `/admin/claims${qs ? `?${qs}` : ""}`,
  );
  return result ?? EMPTY_PAGE;
}

/** GET /admin/claims/:id -- detalhe de qualquer reclamação. */
export async function getAdminClaim(id: string): Promise<ClaimDetailResponse> {
  const result = await apiFetch<ClaimDetailResponse>(
    `/admin/claims/${encodeURIComponent(id)}`,
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** POST /admin/claims/:id/messages -- admin envia mensagem numa reclamação. */
export async function addAdminClaimMessage(
  claimId: string,
  body: string,
): Promise<ClaimMessageResponse> {
  const result = await apiFetch<ClaimMessageResponse>(
    `/admin/claims/${encodeURIComponent(claimId)}/messages`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** POST /admin/claims/:id/evidence -- admin anexa metadados de evidência a uma reclamação (metadata only). */
export async function addAdminClaimEvidence(
  claimId: string,
  input: AddClaimEvidenceInput,
): Promise<ClaimEvidenceResponse> {
  const result = await apiFetch<ClaimEvidenceResponse>(
    `/admin/claims/${encodeURIComponent(claimId)}/evidence`,
    { method: "POST", body: JSON.stringify(input) },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** PATCH /admin/claims/:id/escalate -- admin escala uma reclamação. */
export async function escalateAdminClaim(id: string): Promise<ClaimResponse> {
  const result = await apiFetch<ClaimResponse>(
    `/admin/claims/${encodeURIComponent(id)}/escalate`,
    { method: "PATCH" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** PATCH /admin/claims/:id/resolve -- admin marca uma reclamação como resolvida. */
export async function resolveAdminClaim(id: string): Promise<ClaimResponse> {
  const result = await apiFetch<ClaimResponse>(
    `/admin/claims/${encodeURIComponent(id)}/resolve`,
    { method: "PATCH" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** PATCH /admin/claims/:id/close -- admin encerra uma reclamação. */
export async function closeAdminClaim(id: string): Promise<ClaimResponse> {
  const result = await apiFetch<ClaimResponse>(
    `/admin/claims/${encodeURIComponent(id)}/close`,
    { method: "PATCH" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}
