import type {
  CheckoutAddress,
  CheckoutLineItem,
  CheckoutPaymentMethod,
  CurrentOrderSummary,
  ShippingOptionId,
} from "@/types/cart";

/** Objeto simples (não array / null). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isValidCreatedAt(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

function parseCheckoutLineItem(value: unknown): CheckoutLineItem | null {
  if (!isPlainObject(value)) return null;
  if (!isNonEmptyString(value.productId)) return null;
  if (!isNonEmptyString(value.slug)) return null;
  if (!isNonEmptyString(value.name)) return null;
  if (typeof value.imageSrc !== "string") return null;
  if (!isPositiveInt(value.quantity)) return null;
  if (!isNonNegativeFinite(value.unitPrice)) return null;
  if (!isNonNegativeFinite(value.lineTotal)) return null;

  return {
    productId: value.productId.trim(),
    slug: value.slug.trim(),
    name: value.name.trim(),
    imageSrc: value.imageSrc,
    quantity: value.quantity,
    unitPrice: value.unitPrice,
    lineTotal: value.lineTotal,
  };
}

function parseShippingAddress(value: unknown): CheckoutAddress | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.cep !== "string") return null;
  if (typeof value.street !== "string") return null;
  if (typeof value.number !== "string") return null;
  if (typeof value.neighborhood !== "string") return null;
  if (typeof value.city !== "string") return null;
  if (typeof value.state !== "string") return null;

  const complement =
    typeof value.complement === "string" && value.complement.trim()
      ? value.complement.trim()
      : undefined;

  return {
    cep: value.cep,
    street: value.street,
    number: value.number,
    complement,
    neighborhood: value.neighborhood,
    city: value.city,
    state: value.state,
  };
}

/**
 * Parser/validator puro de CurrentOrderSummary.
 * Aceita unknown e nunca promove dados inválidos via cast.
 */
export function parseCurrentOrderSummary(
  value: unknown,
): CurrentOrderSummary | null {
  if (!isPlainObject(value)) return null;

  if (!isNonEmptyString(value.orderId)) return null;
  if (!isNonEmptyString(value.checkoutTransactionId)) return null;
  if (!Array.isArray(value.items)) return null;

  const items: CheckoutLineItem[] = [];
  for (const entry of value.items) {
    const item = parseCheckoutLineItem(entry);
    if (!item) return null;
    items.push(item);
  }

  if (!isNonNegativeFinite(value.subtotal)) return null;
  // Ausente em resumos gravados antes desta rodada -- trata como 0 em vez
  // de invalidar o pedido inteiro (diferente de subtotal/shippingCost/total,
  // que sempre existiram).
  const discount = isNonNegativeFinite(value.discount) ? value.discount : 0;
  if (!isNonNegativeFinite(value.shippingCost)) return null;
  if (!isNonNegativeFinite(value.total)) return null;

  const shippingOption = value.shippingOption;
  if (shippingOption !== "economic" && shippingOption !== "express") {
    return null;
  }

  const paymentMethod = value.paymentMethod;
  if (
    paymentMethod !== "pix" &&
    paymentMethod !== "card" &&
    paymentMethod !== "boleto"
  ) {
    return null;
  }

  if (typeof value.shippingLabel !== "string") return null;
  if (typeof value.paymentLabel !== "string") return null;
  if (!isNonEmptyString(value.customerName)) return null;
  if (typeof value.customerEmail !== "string") return null;
  if (typeof value.customerPhone !== "string") return null;

  const shippingAddress = parseShippingAddress(value.shippingAddress);
  if (!shippingAddress) return null;

  if (!isValidCreatedAt(value.createdAt)) return null;

  return {
    orderId: value.orderId.trim(),
    checkoutTransactionId: value.checkoutTransactionId.trim(),
    items,
    subtotal: value.subtotal,
    discount,
    shippingOption: shippingOption as ShippingOptionId,
    shippingLabel: value.shippingLabel,
    shippingCost: value.shippingCost,
    total: value.total,
    paymentMethod: paymentMethod as CheckoutPaymentMethod,
    paymentLabel: value.paymentLabel,
    customerName: value.customerName.trim(),
    customerEmail: value.customerEmail,
    customerPhone: value.customerPhone,
    shippingAddress,
    createdAt: value.createdAt,
  };
}
