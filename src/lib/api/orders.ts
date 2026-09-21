import { apiFetch } from "./client";

/**
 * New this session — Fase 2 do plano até 05/10 (checkout real, ver
 * status-migracao-microservicos.md no Claude Project). Client for
 * potala-orders-service's `POST /orders/checkout` (e os endpoints de
 * leitura), acessado pelo gateway igual a toda chamada autenticada deste
 * app (`apiFetch` já manda `credentials: "include"`).
 *
 * Toda rota de OrdersController exige sessão CUSTOMER (SessionAuthGuard +
 * RolesGuard, `@Roles(Role.CUSTOMER)` na classe) — visitante anônimo recebe
 * 401, vendedor/admin recebe 403. Este cliente não tenta identificar o
 * cliente ele mesmo: o backend resolve isso inteiramente pelo cookie de
 * sessão, nunca pelo corpo da requisição.
 */

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "CANCELLED"
  | "FULFILLING"
  | "COMPLETED";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  CANCELLED: "Cancelado",
  FULFILLING: "Em separação/envio",
  COMPLETED: "Concluído",
};

export type SellerOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentTransactionStatus =
  | "PENDING"
  | "APPROVED"
  | "FAILED"
  | "CANCELLED";

export const PAYMENT_TRANSACTION_STATUS_LABEL: Record<PaymentTransactionStatus, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
};

export interface CheckoutItemInput {
  productId: string;
  variantId: string;
  quantity: number;
}

/**
 * Mirrors ShippingAddressDto (orders-service) campo a campo — atenção:
 * `postalCode`, não `cep`, e o campo extra `recipient` que o
 * `CheckoutAddress` local não tem.
 */
export interface CheckoutShippingAddressInput {
  recipient: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface CheckoutInput {
  items: CheckoutItemInput[];
  shippingAddress: CheckoutShippingAddressInput;
}

export interface OrderItemResponse {
  id: string;
  sellerOrderId: string;
  productId: string;
  variantId: string;
  productTitle: string;
  sku: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface SellerOrderResponse {
  id: string;
  orderId: string;
  sellerId: string;
  status: SellerOrderStatus;
  subtotalCents: number;
  shippingCents: number;
  commissionCents: number;
  sellerNetCents: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItemResponse[];
}

export interface OrderShippingAddressResponse {
  recipient: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface PaymentTransactionResponse {
  id: string;
  orderId: string;
  status: PaymentTransactionStatus;
  amountCents: number;
  provider: string;
  providerRef: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Sem `items` no nível raiz de propósito: um carrinho pode ter produtos de
 * vendedores diferentes, e o orders-service divide isso em um
 * `SellerOrder` por vendedor — cada um com seus próprios itens.
 */
export interface OrderResponse {
  id: string;
  customerId: string;
  orderNumber: string;
  status: OrderStatus;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  shippingAddress: OrderShippingAddressResponse | null;
  sellerOrders: SellerOrderResponse[];
  paymentTransactions: PaymentTransactionResponse[];
}

/**
 * POST /orders/checkout — cria um pedido real a partir do carrinho. Preço,
 * título, SKU e vendedor de cada item são sempre resolvidos no servidor a
 * partir de productId/variantId (contra catalog-service) — nunca a partir
 * do que este payload manda além disso. Um 2xx aqui não garante pagamento
 * aprovado por si só (embora o gateway mock desta v1 sempre aprove) — o
 * `status` da resposta é que diz o estado real.
 *
 * Sem chave de idempotência: um retry de rede neste endpoint cria um
 * pedido novo, distinto. O chamador deve evitar disparar duas vezes
 * enquanto uma chamada está em voo (ver `submitting` em checkout/page.tsx).
 */
export async function checkout(input: CheckoutInput): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>("/orders/checkout", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

export interface PageInfo {
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface Paginated<T> {
  items: T[];
  pageInfo: PageInfo;
}

/** GET /orders — pedidos do próprio cliente autenticado, paginados por cursor. */
export async function listMyOrders(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<OrderResponse>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<OrderResponse>>(`/orders${qs ? `?${qs}` : ""}`);
  return result ?? { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
}

/** GET /orders/:id — 404 (não 403) para um pedido de outro cliente, mesmo padrão de "404 indistinguível" do resto da API. */
export async function getMyOrder(id: string): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>(`/orders/${encodeURIComponent(id)}`);
  if (!result) {
    throw new Error("Pedido não encontrado.");
  }
  return result;
}
