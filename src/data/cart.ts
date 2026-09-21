import type {
  CartItem,
  CheckoutPaymentMethod,
  PendingCheckoutOperation,
  ShippingOptionId,
} from "@/types/cart";
import { parseCurrentOrderSummary } from "@/lib/parseCurrentOrderSummary";

export const CART_STORAGE_KEY = "potala-marketplace-cart-v1";
export const ORDER_STORAGE_KEY = "potala-marketplace-last-order-v1";
/** @deprecated Prefer CHECKOUT_PENDING_STORAGE_KEY; mantido só para limpeza de sessões legadas. */
export const CHECKOUT_TRANSACTION_STORAGE_KEY =
  "potala-marketplace-checkout-tx-v1";
/** Operação de checkout pendente (orderId + transactionId + snapshot). */
export const CHECKOUT_PENDING_STORAGE_KEY =
  "potala-marketplace-checkout-pending-v1";

export const SHIPPING_OPTIONS: Record<
  ShippingOptionId,
  { id: ShippingOptionId; label: string; description: string; cost: number }
> = {
  economic: {
    id: "economic",
    label: "Econômica",
    description: "5 a 8 dias úteis",
    cost: 18.9,
  },
  express: {
    id: "express",
    label: "Expressa",
    description: "2 a 3 dias úteis",
    cost: 32.9,
  },
};

export const PAYMENT_LABELS: Record<CheckoutPaymentMethod, string> = {
  pix: "Pix",
  card: "Cartão de crédito",
  boleto: "Boleto bancário",
};

export function clampQuantity(quantity: number, stock: number): number {
  if (!Number.isFinite(quantity) || quantity < 1) {
    return 1;
  }

  const max = Math.max(1, Math.floor(stock));
  return Math.min(Math.floor(quantity), max);
}

export function calcLineTotal(unitPrice: number, quantity: number): number {
  return Number((unitPrice * quantity).toFixed(2));
}

export function calcCartSubtotal(items: CartItem[]): number {
  return Number(
    items
      .reduce((total, item) => total + calcLineTotal(item.unitPrice, item.quantity), 0)
      .toFixed(2),
  );
}

export function calcCartTotalItems(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.productId === "string" &&
    typeof item.variantId === "string" &&
    typeof item.slug === "string" &&
    typeof item.name === "string" &&
    typeof item.category === "string" &&
    typeof item.imageSrc === "string" &&
    typeof item.unitPrice === "number" &&
    Number.isFinite(item.unitPrice) &&
    typeof item.quantity === "number" &&
    Number.isFinite(item.quantity) &&
    typeof item.stock === "number" &&
    Number.isFinite(item.stock)
  );
}

export function parseCartItems(raw: string | null): CartItem[] | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return null;
    }

    const items: CartItem[] = [];

    for (const entry of parsed) {
      if (!isCartItem(entry)) {
        return null;
      }

      items.push({
        ...entry,
        quantity: clampQuantity(entry.quantity, entry.stock),
        unitPrice: Number(entry.unitPrice),
        stock: Math.max(1, Math.floor(entry.stock)),
      });
    }

    return items;
  } catch {
    return null;
  }
}

/** Identificador aleatório via Web Crypto (sem Math.random). */
export function createCryptoRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // RFC 4122 variant bits for a UUID-shaped string
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  throw new Error(
    "Web Crypto API indisponível para gerar identificadores seguros.",
  );
}

/**
 * Identidade de pedido suficientemente única (compatível com códigos legados POT-ANO-####).
 * Novos pedidos usam UUID; pedidos antigos armazenados não são alterados.
 */
export function createOrderId(): string {
  const year = new Date().getFullYear();
  return `POT-${year}-${createCryptoRandomId()}`;
}

/** Garante um ID de transação estável para retries da mesma finalização. */
export function ensureCheckoutTransactionId(
  existing?: string | null,
): string {
  if (existing && existing.trim()) {
    return existing.trim();
  }
  return createCryptoRandomId();
}

/** Impressão digital estável do carrinho para vincular à operação pendente. */
export function createCartFingerprint(items: CartItem[]): string {
  return items
    .map(
      (item) =>
        `${item.productId}:${item.quantity}:${Number(item.unitPrice).toFixed(2)}`,
    )
    .sort()
    .join("|");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parsePendingCheckoutOperation(
  raw: string | null,
): PendingCheckoutOperation | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return null;
    if (parsed.version !== 1) return null;
    if (!(parsed.userId === null || typeof parsed.userId === "string")) {
      return null;
    }
    if (typeof parsed.cartFingerprint !== "string") return null;

    const order = parseCurrentOrderSummary(parsed.order);
    if (!order) return null;

    return {
      version: 1,
      userId: parsed.userId,
      cartFingerprint: parsed.cartFingerprint,
      order,
    };
  } catch {
    return null;
  }
}

export function readPendingCheckoutOperation(): PendingCheckoutOperation | null {
  if (typeof window === "undefined") return null;
  try {
    return parsePendingCheckoutOperation(
      window.sessionStorage.getItem(CHECKOUT_PENDING_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

/**
 * Verifica se a pendência já corresponde à última confirmação gravada.
 * Nesse caso a operação terminou e não deve ser reutilizada.
 */
export function isPendingAlreadyConfirmed(
  pending: PendingCheckoutOperation,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return false;
    const confirmed = parseCurrentOrderSummary(JSON.parse(raw) as unknown);
    if (!confirmed) return false;
    return (
      confirmed.orderId === pending.order.orderId &&
      confirmed.checkoutTransactionId === pending.order.checkoutTransactionId
    );
  } catch {
    return false;
  }
}

export function writePendingCheckoutOperation(
  operation: PendingCheckoutOperation,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(
      CHECKOUT_PENDING_STORAGE_KEY,
      JSON.stringify(operation),
    );
    return true;
  } catch {
    return false;
  }
}

export type ClearPendingCheckoutResult = {
  pendingCleared: boolean;
  legacyTxCleared: boolean;
};

export function clearPendingCheckoutOperation(): ClearPendingCheckoutResult {
  const result: ClearPendingCheckoutResult = {
    pendingCleared: false,
    legacyTxCleared: false,
  };

  if (typeof window === "undefined") {
    return result;
  }

  try {
    window.sessionStorage.removeItem(CHECKOUT_PENDING_STORAGE_KEY);
    result.pendingCleared =
      window.sessionStorage.getItem(CHECKOUT_PENDING_STORAGE_KEY) == null;
  } catch {
    result.pendingCleared = false;
  }

  try {
    window.sessionStorage.removeItem(CHECKOUT_TRANSACTION_STORAGE_KEY);
    result.legacyTxCleared =
      window.sessionStorage.getItem(CHECKOUT_TRANSACTION_STORAGE_KEY) == null;
  } catch {
    result.legacyTxCleared = false;
  }

  return result;
}
