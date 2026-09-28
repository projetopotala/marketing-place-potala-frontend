import { apiFetch } from "./client";
import type { Paginated } from "./admin";

/**
 * Client novo pra tela "Cupons" (admin, CRUD completo) e "Cupons" (loja,
 * somente leitura) -- pedido de Arthur, urgente (ver
 * status-migracao-microservicos.md). Contra
 * GET/POST/PATCH/DELETE /admin/coupons (orders-service) e
 * GET /seller/coupons (mesma service, somente leitura) -- ambas expostas
 * pelo gateway sob rotas novas, sem sellerId em Coupon (cupom é
 * marketplace-wide, nunca por loja -- ver comentário no model Coupon em
 * schema.prisma no backend).
 */

export type CouponDiscountType = "PERCENT" | "FIXED";

/** Derivado no backend (CouponsService.deriveStatus) a partir de enabled + startsAt/endsAt -- nunca uma coluna própria. */
export type CouponStatus = "active" | "scheduled" | "expired" | "disabled";

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  active: "Ativo",
  scheduled: "Agendado",
  expired: "Expirado",
  disabled: "Desativado",
};

export interface Coupon {
  id: string;
  code: string;
  name: string;
  discountType: CouponDiscountType;
  discountValue: number;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  usageCount: number;
  totalDiscountCents: number;
  status: CouponStatus;
  createdAt: string;
  updatedAt: string;
}

export async function listAdminCoupons(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<Coupon>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<Coupon>>(`/admin/coupons${qs ? `?${qs}` : ""}`);
  return result ?? { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
}

export interface CreateCouponInput {
  code: string;
  name: string;
  discountType: CouponDiscountType;
  discountValue: number;
  startsAt: string;
  endsAt: string;
  enabled?: boolean;
}

export async function createCoupon(input: CreateCouponInput): Promise<Coupon> {
  const result = await apiFetch<Coupon>("/admin/coupons", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!result) throw new Error("Resposta vazia ao criar o cupom.");
  return result;
}

export type UpdateCouponInput = Partial<CreateCouponInput>;

export async function updateCoupon(id: string, input: UpdateCouponInput): Promise<Coupon> {
  const result = await apiFetch<Coupon>(`/admin/coupons/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!result) throw new Error("Resposta vazia ao salvar o cupom.");
  return result;
}

async function setCouponEnabled(id: string, action: "activate" | "deactivate"): Promise<Coupon> {
  const result = await apiFetch<Coupon>(
    `/admin/coupons/${encodeURIComponent(id)}/${action}`,
    { method: "PATCH" },
  );
  if (!result) throw new Error("Resposta vazia do servidor.");
  return result;
}

export function activateCoupon(id: string): Promise<Coupon> {
  return setCouponEnabled(id, "activate");
}

export function deactivateCoupon(id: string): Promise<Coupon> {
  return setCouponEnabled(id, "deactivate");
}

export async function deleteCoupon(id: string): Promise<void> {
  await apiFetch<null>(`/admin/coupons/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** GET /seller/coupons -- promoções vigentes, somente leitura, sem paginação (lista pequena por natureza). */
export async function listActiveCouponsForSeller(): Promise<Coupon[]> {
  const result = await apiFetch<Coupon[]>("/seller/coupons");
  return result ?? [];
}

/**
 * GET /orders/coupons -- mesma leitura de listActiveCouponsForSeller
 * acima, só que pelo lado do cliente (orders-service, novo nesta sessão).
 * Cupom continua marketplace-wide (sem sellerId), então a lista é a mesma
 * pra qualquer cliente autenticado.
 */
export async function listActiveCouponsForCustomer(): Promise<Coupon[]> {
  const result = await apiFetch<Coupon[]>("/orders/coupons");
  return result ?? [];
}
