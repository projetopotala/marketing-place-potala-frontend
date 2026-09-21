"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AddCartItemInput, CartItem } from "@/types/cart";
import {
  calcCartSubtotal,
  calcCartTotalItems,
  CART_STORAGE_KEY,
  clampQuantity,
  parseCartItems,
} from "@/data/cart";

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  isReady: boolean;
  addItem: (input: AddCartItemInput) => boolean;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  /**
   * Consome quantidades confirmadas no checkout, preservando
   * saldos adicionados depois e produtos fora do pedido.
   */
  consumeCheckoutItems: (
    confirmed: Array<{ productId: string; quantity: number }>,
  ) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  return parseCartItems(window.localStorage.getItem(CART_STORAGE_KEY)) ?? [];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }

      setItems(readStoredCart());
      setIsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items, isReady]);

  const addItem = useCallback((input: AddCartItemInput) => {
    const rawStock = Math.floor(input.stock);
    if (!Number.isFinite(rawStock) || rawStock < 1) {
      return false;
    }

    const stock = rawStock;
    const quantityToAdd = clampQuantity(input.quantity, stock);
    let added = false;

    setItems((current) => {
      const existing = current.find((item) => item.productId === input.productId);

      if (!existing) {
        added = true;
        return [
          ...current,
          {
            productId: input.productId,
            variantId: input.variantId,
            slug: input.slug,
            name: input.name,
            category: input.category,
            imageSrc: input.imageSrc,
            unitPrice: input.unitPrice,
            stock,
            quantity: quantityToAdd,
          },
        ];
      }

      const nextQuantity = clampQuantity(existing.quantity + quantityToAdd, stock);
      added = nextQuantity > existing.quantity;

      return current.map((item) =>
        item.productId === input.productId
          ? {
              ...item,
              variantId: input.variantId,
              stock,
              unitPrice: input.unitPrice,
              imageSrc: input.imageSrc,
              name: input.name,
              category: input.category,
              slug: input.slug,
              quantity: nextQuantity,
            }
          : item,
      );
    });

    return added;
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((current) => current.filter((item) => item.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((current) =>
      current.map((item) =>
        item.productId === productId
          ? { ...item, quantity: clampQuantity(quantity, item.stock) }
          : item,
      ),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const consumeCheckoutItems = useCallback(
    (confirmed: Array<{ productId: string; quantity: number }>) => {
      setItems((current) => {
        const toConsume = new Map<string, number>();
        for (const entry of confirmed) {
          if (typeof entry.productId !== "string" || !entry.productId.trim()) {
            continue;
          }
          if (
            typeof entry.quantity !== "number" ||
            !Number.isFinite(entry.quantity) ||
            entry.quantity <= 0
          ) {
            continue;
          }
          const id = entry.productId.trim();
          toConsume.set(id, (toConsume.get(id) ?? 0) + entry.quantity);
        }

        if (toConsume.size === 0) {
          return current;
        }

        const next: CartItem[] = [];
        for (const item of current) {
          const consumeQty = toConsume.get(item.productId) ?? 0;
          if (consumeQty <= 0) {
            next.push(item);
            continue;
          }
          const remaining = item.quantity - consumeQty;
          if (remaining > 0) {
            next.push({ ...item, quantity: remaining });
          }
        }
        return next;
      });
    },
    [],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalItems: calcCartTotalItems(items),
      subtotal: calcCartSubtotal(items),
      isReady,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      consumeCheckoutItems,
    }),
    [
      items,
      isReady,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      consumeCheckoutItems,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart deve ser usado dentro de CartProvider.");
  }

  return context;
}
