import type {
  CheckoutAddress,
  CheckoutLineItem,
  CheckoutPaymentMethod,
  CurrentOrderSummary,
  LegacyOrderSummary,
  ShippingOptionId,
  StoredOrderSummary,
} from "@/types/cart";
import { formatCheckoutAddressLabel } from "@/types/cart";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCheckoutAddress(value: unknown): value is CheckoutAddress {
  if (!isRecord(value)) return false;
  return (
    typeof value.cep === "string" &&
    typeof value.street === "string" &&
    typeof value.number === "string" &&
    typeof value.neighborhood === "string" &&
    typeof value.city === "string" &&
    typeof value.state === "string"
  );
}

function normalizeAddress(address: CheckoutAddress): CheckoutAddress {
  const complement = address.complement?.trim();
  return {
    cep: address.cep.trim(),
    street: address.street.trim(),
    number: address.number.trim(),
    complement: complement ? complement : undefined,
    neighborhood: address.neighborhood.trim(),
    city: address.city.trim(),
    state: address.state.trim().toUpperCase(),
  };
}

/**
 * Lê pedido do sessionStorage.
 * Aceita legado com `address` em vez de `shippingAddress` e e-mail/telefone opcionais.
 * Retorna CurrentOrderSummary quando há checkoutTransactionId; caso contrário LegacyOrderSummary.
 */
export function parseStoredOrderSummary(
  raw: string | null,
): StoredOrderSummary | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    if (typeof parsed.orderId !== "string" || !Array.isArray(parsed.items)) {
      return null;
    }

    const legacyAddress = isCheckoutAddress(parsed.address)
      ? parsed.address
      : null;
    const shippingAddressRaw = isCheckoutAddress(parsed.shippingAddress)
      ? parsed.shippingAddress
      : legacyAddress;

    if (!shippingAddressRaw) return null;

    const paymentMethod = parsed.paymentMethod;
    if (
      paymentMethod !== "pix" &&
      paymentMethod !== "card" &&
      paymentMethod !== "boleto"
    ) {
      return null;
    }

    const shippingOption = parsed.shippingOption;
    if (shippingOption !== "economic" && shippingOption !== "express") {
      return null;
    }

    const customerName =
      typeof parsed.customerName === "string" ? parsed.customerName.trim() : "";
    const customerEmail =
      typeof parsed.customerEmail === "string"
        ? parsed.customerEmail.trim()
        : "";
    const customerPhone =
      typeof parsed.customerPhone === "string"
        ? parsed.customerPhone.trim()
        : "";

    if (!customerName) return null;

    const base = {
      orderId: parsed.orderId,
      items: parsed.items as CheckoutLineItem[],
      subtotal: Number(parsed.subtotal) || 0,
      // Ausente em resumos legados salvos antes desta rodada -- cai pro
      // default 0, mesmo raciocínio dos outros campos numéricos aqui.
      discount: Number(parsed.discount) || 0,
      shippingOption: shippingOption as ShippingOptionId,
      shippingLabel:
        typeof parsed.shippingLabel === "string" ? parsed.shippingLabel : "",
      shippingCost: Number(parsed.shippingCost) || 0,
      total: Number(parsed.total) || 0,
      paymentMethod: paymentMethod as CheckoutPaymentMethod,
      paymentLabel:
        typeof parsed.paymentLabel === "string" ? parsed.paymentLabel : "",
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress: normalizeAddress(shippingAddressRaw),
      createdAt:
        typeof parsed.createdAt === "string"
          ? parsed.createdAt
          : new Date().toISOString(),
    };

    const tx =
      typeof parsed.checkoutTransactionId === "string" &&
      parsed.checkoutTransactionId.trim()
        ? parsed.checkoutTransactionId.trim()
        : null;

    if (tx) {
      const current: CurrentOrderSummary = {
        ...base,
        checkoutTransactionId: tx,
      };
      return current;
    }

    const legacy: LegacyOrderSummary = { ...base };
    return legacy;
  } catch {
    return null;
  }
}

export { formatCheckoutAddressLabel };
