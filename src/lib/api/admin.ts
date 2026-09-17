import { apiFetch } from "./client";

/** Mirrors sellers-service's Prisma SellerStatus enum (prisma/schema.prisma). */
export type AdminSellerStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";

export const ADMIN_SELLER_STATUS_LABEL: Record<AdminSellerStatus, string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  REJECTED: "Rejeitado",
};

/** Mirrors sellers-service's DocumentType enum. */
export type AdminSellerDocumentType = "CPF" | "CNPJ";

/**
 * Mirrors AdminService.SELLER_LIST_SELECT (sellers-service,
 * modules/admin/admin.service.ts) exactly — this is everything
 * GET /admin/sellers returns per row. There is no GET /admin/sellers/:id
 * and no admin endpoint for a seller's products/orders/audit history —
 * those don't exist yet, so there is no real data to back a detail page.
 */
export interface AdminSeller {
  id: string;
  legalName: string;
  tradeName: string;
  slug: string;
  documentType: AdminSellerDocumentType;
  documentNumber: string;
  email: string;
  status: AdminSellerStatus;
  statusReason: string | null;
  reviewedAt: string | null;
  commissionBps: number | null;
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

/** Result shape of every PATCH /admin/sellers/:id/(approve|reject|suspend) call. */
export interface AdminSellerReviewResult {
  id: string;
  tradeName: string;
  status: AdminSellerStatus;
  statusReason: string | null;
  reviewedAt: string | null;
}

/**
 * GET /admin/sellers — cursor-paginated, no search/status filter server-side
 * (same PaginationQueryDto as everywhere else in this backend: only
 * limit/cursor). Finding pending sellers among many pages means paging
 * through them; there's no way to ask the backend for "only PENDING" yet.
 */
export async function listAdminSellers(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<AdminSeller>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<AdminSeller>>(
    `/admin/sellers${qs ? `?${qs}` : ""}`,
  );
  return result ?? { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
}

async function reviewSeller(
  id: string,
  action: "approve" | "reject" | "suspend",
  reason?: string,
): Promise<AdminSellerReviewResult> {
  const result = await apiFetch<AdminSellerReviewResult>(
    `/admin/sellers/${encodeURIComponent(id)}/${action}`,
    {
      method: "PATCH",
      body: JSON.stringify(reason?.trim() ? { reason: reason.trim() } : {}),
    },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

export function approveSeller(id: string): Promise<AdminSellerReviewResult> {
  return reviewSeller(id, "approve");
}

export function rejectSeller(id: string, reason?: string): Promise<AdminSellerReviewResult> {
  return reviewSeller(id, "reject", reason);
}

export function suspendSeller(id: string, reason?: string): Promise<AdminSellerReviewResult> {
  return reviewSeller(id, "suspend", reason);
}

/** Mirrors catalog-service's Prisma CategoryStatus enum. */
export type AdminCategoryStatus = "ACTIVE" | "INACTIVE";

export const ADMIN_CATEGORY_STATUS_LABEL: Record<AdminCategoryStatus, string> = {
  ACTIVE: "Ativa",
  INACTIVE: "Inativa",
};

/** Mirrors AdminCategoriesController's response shape (catalog-service) exactly. */
export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  status: AdminCategoryStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /admin/categories — every category, ACTIVE and INACTIVE, unpaginated
 * (small dataset, same call shape as GET /seller/categories). No search/
 * filter server-side; the list is short enough to filter client-side if
 * ever needed.
 */
export async function listAdminCategories(): Promise<AdminCategory[]> {
  const result = await apiFetch<AdminCategory[]>("/admin/categories");
  return result ?? [];
}

/** POST /admin/categories — slug is always derived from `name` server-side, never sent here. */
export async function createAdminCategory(name: string): Promise<AdminCategory> {
  const result = await apiFetch<AdminCategory>("/admin/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** PATCH /admin/categories/:id — partial; renaming regenerates the slug server-side. */
export async function updateAdminCategory(
  id: string,
  patch: { name?: string; status?: AdminCategoryStatus },
): Promise<AdminCategory> {
  const result = await apiFetch<AdminCategory>(
    `/admin/categories/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}
