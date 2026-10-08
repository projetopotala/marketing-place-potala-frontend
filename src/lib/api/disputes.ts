import { apiFetch } from "./client";

/**
 * Disputas (pós-venda, mediação formal) -- client for potala-orders-service's
 * Dispute endpoints, através do gateway. Uma Dispute nasce de uma Claim OU de
 * uma Return contestada (nunca das duas), nunca é criada diretamente -- só
 * "escalada" a partir de uma dessas origens (ver claims.ts/returns.ts):
 * `POST /{orders|seller|admin}/claims/:id/dispute` e
 * `POST /{orders|seller}/returns/:id/dispute` + `POST /admin/returns/:id/dispute`.
 *
 * CUSTOMER e SELLER só leem (consulta própria, tenant-scoped em SQL no
 * backend); somente ADMIN lista todas as disputas e registra decisões
 * (`POST /admin/disputes/:id/decisions`). Nenhuma operação aqui aceita
 * customerId/sellerId/role do chamador -- a identidade sempre vem da sessão
 * (cookie HttpOnly), resolvida pelo backend, nunca deste client.
 */

export type DisputeStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "WAITING_CUSTOMER"
  | "WAITING_SELLER"
  | "RESOLVED"
  | "CLOSED";

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  OPEN: "Aberta",
  UNDER_REVIEW: "Em análise",
  WAITING_CUSTOMER: "Aguardando cliente",
  WAITING_SELLER: "Aguardando vendedor",
  RESOLVED: "Resolvida",
  CLOSED: "Encerrada",
};

export type DisputeOutcome =
  | "CUSTOMER_FAVORED"
  | "SELLER_FAVORED"
  | "PARTIAL"
  | "NO_ACTION";

export const DISPUTE_OUTCOME_LABEL: Record<DisputeOutcome, string> = {
  CUSTOMER_FAVORED: "Favorável ao cliente",
  SELLER_FAVORED: "Favorável ao vendedor",
  PARTIAL: "Parcial",
  NO_ACTION: "Sem ação",
};

/**
 * Resumo embutido em `ClaimDetailResponse.dispute` (claims.ts) e em
 * `ReturnListItemResponse.dispute` (returns.ts) -- projeção própria e menor
 * (`ClaimsService`/`ReturnsService`, `dispute: { select: { id, status,
 * outcome, openedAt, resolvedAt } }`), nunca o objeto completo de
 * DisputeResponse abaixo (sem claimId/returnId/closedAt, sem decisions).
 */
export interface DisputeSummary {
  id: string;
  status: DisputeStatus;
  outcome: DisputeOutcome | null;
  openedAt: string;
  resolvedAt: string | null;
}

/**
 * Forma crua de uma Dispute -- exatamente o que `POST .../dispute` devolve
 * ao criar (`tx.dispute.create`, sem include) e o que cada linha de
 * `listAdminDisputes` traz (`findMany` sem select/include). Nunca inclui
 * `decisions` -- isso só existe no detalhe (ver `DisputeDetailResponse`/
 * `AdminDisputeDetailResponse` abaixo).
 */
export interface DisputeResponse {
  id: string;
  claimId: string | null;
  returnId: string | null;
  status: DisputeStatus;
  outcome: DisputeOutcome | null;
  openedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

/**
 * Decisão como aparece para CUSTOMER/SELLER (`DisputesService.
 * TENANT_FACING_SELECT`, decisions.select) -- nunca `decidedByUserId`
 * (identificador administrativo interno, excluído de propósito) nem `id`/
 * `disputeId`. Comparar com `AdminDisputeDecisionResponse` abaixo.
 */
export interface DisputeDecisionSummary {
  outcome: DisputeOutcome;
  reason: string;
  createdAt: string;
}

/** GET /{orders|seller}/disputes/:id -- CUSTOMER/SELLER, tenant-scoped em SQL no backend. */
export interface DisputeDetailResponse extends DisputeResponse {
  decisions: DisputeDecisionSummary[];
}

/**
 * Decisão completa, como só o ADMIN vê (`DisputesService.getForAdmin`,
 * `include: { decisions: true }`, objeto inteiro de DisputeDecision) --
 * inclui `decidedByUserId`. Também é exatamente o que `POST
 * /admin/disputes/:id/decisions` devolve (`tx.disputeDecision.create`
 * retorna a DisputeDecision criada, nunca a Dispute).
 */
export interface AdminDisputeDecisionResponse {
  id: string;
  disputeId: string;
  decidedByUserId: string;
  outcome: DisputeOutcome;
  reason: string;
  createdAt: string;
}

/** GET /admin/disputes/:id -- ADMIN. */
export interface AdminDisputeDetailResponse extends DisputeResponse {
  decisions: AdminDisputeDecisionResponse[];
}

export interface PageInfo {
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface Paginated<T> {
  items: T[];
  pageInfo: PageInfo;
}

const EMPTY_PAGE: Paginated<DisputeResponse> = {
  items: [],
  pageInfo: { hasNextPage: false, nextCursor: null },
};

export interface RecordDisputeDecisionInput {
  outcome: DisputeOutcome;
  reason: string;
}

// ---------------------------------------------------------------------------
// CUSTOMER -- abrir disputa a partir de uma Claim/Return própria, e
// consultar uma disputa da qual é parte (origem na própria Claim ou Return,
// nunca distinguido de "não existe": 404 indistinguível, mesmo padrão do
// resto da API).
// ---------------------------------------------------------------------------

/** POST /orders/claims/:id/dispute -- escala uma Claim própria para Dispute (sem corpo). */
export async function openMyClaimDispute(claimId: string): Promise<DisputeResponse> {
  const result = await apiFetch<DisputeResponse>(
    `/orders/claims/${encodeURIComponent(claimId)}/dispute`,
    { method: "POST" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** POST /orders/returns/:id/dispute -- contesta uma Return própria, abrindo uma Dispute (sem corpo). */
export async function openMyReturnDispute(returnId: string): Promise<DisputeResponse> {
  const result = await apiFetch<DisputeResponse>(
    `/orders/returns/${encodeURIComponent(returnId)}/dispute`,
    { method: "POST" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** GET /orders/disputes/:id -- disputa própria (origem numa Claim ou Return do cliente autenticado). */
export async function getMyDispute(id: string): Promise<DisputeDetailResponse> {
  const result = await apiFetch<DisputeDetailResponse>(
    `/orders/disputes/${encodeURIComponent(id)}`,
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

// ---------------------------------------------------------------------------
// SELLER -- mesmo padrão de CUSTOMER acima, mas pela loja autenticada
// (`/seller/...`). Vendedor nunca registra decisão -- isso é exclusivo do
// ADMIN (ver record AdminDisputeDecision abaixo).
// ---------------------------------------------------------------------------

/** POST /seller/claims/:id/dispute -- escala uma Claim da própria loja para Dispute (sem corpo). */
export async function openMySellerClaimDispute(claimId: string): Promise<DisputeResponse> {
  const result = await apiFetch<DisputeResponse>(
    `/seller/claims/${encodeURIComponent(claimId)}/dispute`,
    { method: "POST" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** POST /seller/returns/:id/dispute -- contesta uma Return da própria loja, abrindo uma Dispute (sem corpo). */
export async function openMySellerReturnDispute(returnId: string): Promise<DisputeResponse> {
  const result = await apiFetch<DisputeResponse>(
    `/seller/returns/${encodeURIComponent(returnId)}/dispute`,
    { method: "POST" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** GET /seller/disputes/:id -- disputa da própria loja (origem numa Claim ou Return do vendedor autenticado). */
export async function getMySellerDispute(id: string): Promise<DisputeDetailResponse> {
  const result = await apiFetch<DisputeDetailResponse>(
    `/seller/disputes/${encodeURIComponent(id)}`,
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

// ---------------------------------------------------------------------------
// ADMIN -- único papel que lista todas as disputas do marketplace e que
// registra decisão. Pode abrir disputa a partir de qualquer Claim/Return
// (sem tenant-scoping no backend para este papel).
// ---------------------------------------------------------------------------

/** POST /admin/claims/:id/dispute -- admin escala qualquer Claim para Dispute (sem corpo). */
export async function openAdminClaimDispute(claimId: string): Promise<DisputeResponse> {
  const result = await apiFetch<DisputeResponse>(
    `/admin/claims/${encodeURIComponent(claimId)}/dispute`,
    { method: "POST" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** POST /admin/returns/:id/dispute -- admin contesta qualquer Return, abrindo uma Dispute (sem corpo). */
export async function openAdminReturnDispute(returnId: string): Promise<DisputeResponse> {
  const result = await apiFetch<DisputeResponse>(
    `/admin/returns/${encodeURIComponent(returnId)}/dispute`,
    { method: "POST" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** GET /admin/disputes -- todas as disputas do marketplace, paginadas por cursor. */
export async function listAdminDisputes(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<DisputeResponse>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<DisputeResponse>>(
    `/admin/disputes${qs ? `?${qs}` : ""}`,
  );
  return result ?? EMPTY_PAGE;
}

/** GET /admin/disputes/:id -- detalhe completo, inclusive decidedByUserId em cada decisão. */
export async function getAdminDispute(id: string): Promise<AdminDisputeDetailResponse> {
  const result = await apiFetch<AdminDisputeDetailResponse>(
    `/admin/disputes/${encodeURIComponent(id)}`,
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/**
 * POST /admin/disputes/:id/decisions -- só ADMIN. decidedByUserId nunca é
 * enviado por este client (RecordDisputeDecisionDto não tem esse campo; o
 * backend resolve a partir da sessão autenticada). Devolve a
 * DisputeDecision criada, não a Dispute (ver AdminDisputeDecisionResponse).
 * Rejeitado com 409 se a disputa já foi decidida (RESOLVED/CLOSED).
 */
export async function recordAdminDisputeDecision(
  id: string,
  input: RecordDisputeDecisionInput,
): Promise<AdminDisputeDecisionResponse> {
  const result = await apiFetch<AdminDisputeDecisionResponse>(
    `/admin/disputes/${encodeURIComponent(id)}/decisions`,
    { method: "POST", body: JSON.stringify(input) },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}
