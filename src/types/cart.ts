export interface CartItem {
  productId: string;
  /** Real product-variant id (catalog-service) — obrigatório pro checkout real, ver POST /orders/checkout. */
  variantId: string;
  slug: string;
  name: string;
  category: string;
  imageSrc: string;
  unitPrice: number;
  quantity: number;
  stock: number;
}

export type ShippingOptionId = "economic" | "express";

export type CheckoutPaymentMethod = "pix" | "card" | "boleto";

export interface CheckoutLineItem {
  productId: string;
  slug: string;
  name: string;
  imageSrc: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CheckoutAddress {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

/** Campos comuns a resumos de pedido atuais e legados. */
export interface OrderSummaryBase {
  orderId: string;
  items: CheckoutLineItem[];
  subtotal: number;
  shippingOption: ShippingOptionId;
  shippingLabel: string;
  shippingCost: number;
  total: number;
  paymentMethod: CheckoutPaymentMethod;
  paymentLabel: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: CheckoutAddress;
  createdAt: string;
}

/**
 * Resumo de checkout atual: identidade de operação obrigatória.
 * Usado em novas finalizações e em appendOrderFromCheckout.
 */
export interface CurrentOrderSummary extends OrderSummaryBase {
  checkoutTransactionId: string;
}

/**
 * Pedido legado já persistido sem identidade de transação.
 * Consumidores devem tratar a ausência explicitamente.
 */
export interface LegacyOrderSummary extends OrderSummaryBase {
  checkoutTransactionId?: never;
}

/** Qualquer resumo lido de storage (atual ou legado). */
export type StoredOrderSummary = CurrentOrderSummary | LegacyOrderSummary;

/**
 * Alias para o formato atual de checkout.
 * Novas operações devem usar CurrentOrderSummary (checkoutTransactionId obrigatório).
 */
export type OrderSummary = CurrentOrderSummary;

export function isCurrentOrderSummary(
  order: StoredOrderSummary,
): order is CurrentOrderSummary {
  return (
    typeof order.checkoutTransactionId === "string" &&
    order.checkoutTransactionId.trim().length > 0
  );
}

/** Resultado tipado da gravação do pedido na conta do cliente. */
export type AppendCheckoutOrderResult =
  | { status: "created"; orderId: string }
  | { status: "already_recorded"; orderId: string }
  | { status: "conflict"; error: string }
  | { status: "failed"; error: string };

/** Operação de checkout em andamento (idempotência entre retries). */
export interface PendingCheckoutOperation {
  version: 1;
  userId: string | null;
  cartFingerprint: string;
  order: CurrentOrderSummary;
}

export interface AddCartItemInput {
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  category: string;
  imageSrc: string;
  unitPrice: number;
  stock: number;
  quantity: number;
}

/** Rótulo de rua/número/complemento para histórico e confirmação. */
export function formatCheckoutAddressLabel(address: CheckoutAddress): string {
  const complement = address.complement?.trim()
    ? ` — ${address.complement.trim()}`
    : "";
  return `${address.street.trim()}, ${address.number.trim()}${complement}`;
}
