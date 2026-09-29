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
import { useAuth } from "@/context/AuthContext";
import type {
  CustomerAccountDb,
  CustomerAddress,
  CustomerFavorite,
  CustomerOrder,
  CustomerReturnRequest,
  CustomerSupportTicket,
} from "@/features/account/domain";
import { CUSTOMER_ACCOUNT_STORAGE_KEY } from "@/features/account/domain";
import {
  createCustomerAccountSeed,
  isCustomerAccountDb,
} from "@/features/account/seed";
import {
  addFavorite as apiAddFavorite,
  listMyFavorites,
  removeFavorite as apiRemoveFavorite,
  type FavoriteResponse,
} from "@/lib/api/favorites";
import type {
  AppendCheckoutOrderResult,
  CurrentOrderSummary,
} from "@/types/cart";
import { formatCheckoutAddressLabel } from "@/types/cart";

interface AccountDataContextValue {
  db: CustomerAccountDb | null;
  isHydrated: boolean;
  /** Real via GET /orders/favorites (orders-service) -- null enquanto carrega/sem sessão de cliente. */
  favorites: FavoriteResponse[] | null;
  favoritesLoading: boolean;
  toggleFavorite: (input: Omit<CustomerFavorite, "addedAt">) => void;
  isFavorite: (productId: string) => boolean;
  saveAddress: (address: Omit<CustomerAddress, "id"> & { id?: string }) => void;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  appendOrderFromCheckout: (
    order: CurrentOrderSummary,
  ) => AppendCheckoutOrderResult;
  submitReview: (input: {
    id: string;
    rating: number;
    comment: string;
  }) => void;
  createReturn: (input: {
    orderId: string;
    itemProductIds: string[];
    reason: string;
    description: string;
  }) => { ok: true } | { ok: false; error: string };
  createSupportTicket: (input: {
    category: string;
    subject: string;
    message: string;
  }) => CustomerSupportTicket;
}

const AccountDataContext = createContext<AccountDataContextValue | null>(null);

function storageKey(userId: string) {
  return `${CUSTOMER_ACCOUNT_STORAGE_KEY}:${userId}`;
}

function readDb(userId: string): CustomerAccountDb {
  if (typeof window === "undefined") {
    return createCustomerAccountSeed(userId);
  }

  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return createCustomerAccountSeed(userId);
    const parsed = JSON.parse(raw) as unknown;
    if (isCustomerAccountDb(parsed) && parsed.userId === userId) {
      return parsed;
    }
  } catch {
    // storage corrompido → seed
  }

  return createCustomerAccountSeed(userId);
}

function writeDb(db: CustomerAccountDb) {
  window.localStorage.setItem(
    storageKey(db.userId),
    JSON.stringify({ ...db, updatedAt: new Date().toISOString() }),
  );
}

function tryWriteDb(db: CustomerAccountDb): { ok: true } | { ok: false; error: string } {
  try {
    writeDb(db);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Não foi possível salvar o pedido na sua conta.";
    return { ok: false, error: message };
  }
}

function uid(prefix: string) {
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : typeof crypto !== "undefined" &&
          typeof crypto.getRandomValues === "function"
        ? Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
            b.toString(16).padStart(2, "0"),
          ).join("")
        : `${Date.now().toString(36)}`;
  return `${prefix}-${unique}`;
}

export function AccountDataProvider({ children }: { children: ReactNode }) {
  const { user, isHydrated: authHydrated } = useAuth();
  const [db, setDb] = useState<CustomerAccountDb | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  // Real via GET /orders/favorites -- ver lib/api/favorites.ts. Não vive
  // mais em `db`/localStorage (era mock, ver seed.ts): `db.favorites`
  // continua existindo só pro shape de CustomerAccountDb não quebrar,
  // nunca mais lido por toggleFavorite/isFavorite abaixo -- mesmo
  // raciocínio já aplicado a submitReview/createReturn (dead code, mock
  // órfão, não removido pra manter o diff pequeno).
  const [favorites, setFavorites] = useState<FavoriteResponse[] | null>(null);
  const [favoritesLoading, setFavoritesLoading] = useState(true);

  useEffect(() => {
    if (!authHydrated) return;

    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;

      if (!user || user.role !== "customer") {
        setDb(null);
        setIsHydrated(true);
        return;
      }

      const next = readDb(user.userId);
      setDb(next);
      writeDb(next);
      setIsHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [authHydrated, user]);

  useEffect(() => {
    if (!authHydrated) return;

    let cancelled = false;
    // Mesmo padrão do efeito de `db` acima (Promise.resolve().then) --
    // evita setState síncrono direto no corpo do efeito
    // (react-hooks/set-state-in-effect), inclusive no branch de saída
    // antecipada (usuário não é cliente).
    Promise.resolve().then(() => {
      if (cancelled) return;

      if (!user || user.role !== "customer") {
        setFavorites(null);
        setFavoritesLoading(false);
        return;
      }

      setFavoritesLoading(true);
      listMyFavorites({ limit: 100 })
        .then((page) => {
          if (!cancelled) setFavorites(page.items);
        })
        .catch((err) => {
          console.error(
            "[AccountDataContext] listMyFavorites failed, degrading to empty list:",
            err,
          );
          if (!cancelled) setFavorites([]);
        })
        .finally(() => {
          if (!cancelled) setFavoritesLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [authHydrated, user]);

  const persist = useCallback((next: CustomerAccountDb) => {
    setDb(next);
    writeDb(next);
  }, []);

  const isFavorite = useCallback(
    (productId: string) =>
      Boolean(favorites?.some((item) => item.productId === productId)),
    [favorites],
  );

  /**
   * Otimista: atualiza `favorites` local antes da resposta do backend --
   * ProductCard chama isto direto num onClick síncrono (sem await), o
   * coração precisa reagir na hora do clique. `add`/`remove` são
   * idempotentes no backend (ver FavoritesService), então uma rajada de
   * cliques nunca gera erro visível; se a chamada falhar de verdade (rede
   * caiu), a atualização otimista é revertida.
   */
  const toggleFavorite = useCallback(
    (input: Omit<CustomerFavorite, "addedAt">) => {
      const { productId } = input;
      const alreadyFavorite = favorites?.some((item) => item.productId === productId) ?? false;

      if (alreadyFavorite) {
        setFavorites((prev) => prev?.filter((item) => item.productId !== productId) ?? prev);
        apiRemoveFavorite(productId).catch((err) => {
          console.error("[AccountDataContext] removeFavorite failed, revertendo:", err);
          setFavorites((prev) =>
            prev
              ? [
                  {
                    id: `revert-${productId}`,
                    customerId: "",
                    productId,
                    createdAt: new Date().toISOString(),
                  },
                  ...prev,
                ]
              : prev,
          );
        });
        return;
      }

      const optimistic: FavoriteResponse = {
        id: `optimistic-${productId}`,
        customerId: "",
        productId,
        createdAt: new Date().toISOString(),
      };
      setFavorites((prev) => (prev ? [optimistic, ...prev] : [optimistic]));
      apiAddFavorite(productId)
        .then((real) => {
          setFavorites((prev) =>
            prev?.map((item) => (item.productId === productId ? real : item)) ?? prev,
          );
        })
        .catch((err) => {
          console.error("[AccountDataContext] addFavorite failed, revertendo:", err);
          setFavorites((prev) => prev?.filter((item) => item.productId !== productId) ?? prev);
        });
    },
    [favorites],
  );

  const saveAddress = useCallback(
    (address: Omit<CustomerAddress, "id"> & { id?: string }) => {
      if (!db) return;
      const id = address.id ?? uid("caddr");
      const withoutDefault = address.isDefault
        ? db.addresses.map((item) => ({ ...item, isDefault: false }))
        : db.addresses;
      const existing = withoutDefault.find((item) => item.id === id);
      const nextAddresses = existing
        ? withoutDefault.map((item) =>
            item.id === id ? { ...item, ...address, id } : item,
          )
        : [...withoutDefault, { ...address, id }];

      if (!nextAddresses.some((item) => item.isDefault) && nextAddresses[0]) {
        nextAddresses[0] = { ...nextAddresses[0], isDefault: true };
      }

      persist({ ...db, addresses: nextAddresses });
    },
    [db, persist],
  );

  const removeAddress = useCallback(
    (id: string) => {
      if (!db) return;
      const target = db.addresses.find((item) => item.id === id);
      if (!target) return;
      if (target.isDefault && db.addresses.length > 1) {
        throw new Error(
          "Defina outro endereço como padrão antes de remover o atual.",
        );
      }
      if (db.addresses.length === 1 && target.isDefault) {
        throw new Error(
          "Não é possível remover o único endereço padrão sem cadastrar outro.",
        );
      }
      persist({
        ...db,
        addresses: db.addresses.filter((item) => item.id !== id),
      });
    },
    [db, persist],
  );

  const setDefaultAddress = useCallback(
    (id: string) => {
      if (!db) return;
      persist({
        ...db,
        addresses: db.addresses.map((item) => ({
          ...item,
          isDefault: item.id === id,
        })),
      });
    },
    [db, persist],
  );

  const appendOrderFromCheckout = useCallback(
    (order: CurrentOrderSummary): AppendCheckoutOrderResult => {
      if (!isHydrated) {
        return {
          status: "failed",
          error:
            "Aguarde o carregamento da sua conta antes de finalizar o pedido.",
        };
      }

      if (!db) {
        return {
          status: "failed",
          error:
            "Não foi possível gravar o pedido na conta. Tente novamente em instantes.",
        };
      }

      const transactionId = order.checkoutTransactionId.trim();
      if (!transactionId) {
        return {
          status: "failed",
          error:
            "Identidade da operação de checkout ausente. Atualize a página e tente novamente.",
        };
      }

      const byTransaction = db.orders.find(
        (item) => item.checkoutTransactionId === transactionId,
      );
      if (byTransaction) {
        return {
          status: "already_recorded",
          orderId: byTransaction.code,
        };
      }

      const byCode = db.orders.find((item) => item.code === order.orderId);
      if (byCode) {
        // Mesmo código com outra transação (ou legado sem tx) = colisão inconsistente.
        // Não tratar como a mesma operação só pelo código.
        return {
          status: "conflict",
          error:
            "Conflito de identidade do pedido. O pedido já existente foi preservado — o carrinho não foi alterado.",
        };
      }

      const { shippingAddress } = order;
      const customerOrder: CustomerOrder = {
        id: uid("cord"),
        code: order.orderId,
        checkoutTransactionId: transactionId,
        status: "paid",
        createdAt: order.createdAt,
        updatedAt: order.createdAt,
        items: order.items.map((item) => ({
          productId: item.productId,
          slug: item.slug,
          name: item.name,
          imageSrc: item.imageSrc,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        subtotal: order.subtotal,
        shippingCost: order.shippingCost,
        shippingLabel: order.shippingLabel,
        discount: 0,
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentLabel: order.paymentLabel,
        addressLabel: formatCheckoutAddressLabel({
          cep: shippingAddress.cep,
          street: shippingAddress.street,
          number: shippingAddress.number,
          complement: shippingAddress.complement,
          neighborhood: shippingAddress.neighborhood,
          city: shippingAddress.city,
          state: shippingAddress.state,
        }),
        city: shippingAddress.city,
        state: shippingAddress.state,
        timeline: [
          {
            id: uid("ct"),
            at: order.createdAt,
            label: "Pedido realizado",
            detail: `${shippingAddress.neighborhood} · CEP ${shippingAddress.cep}`,
          },
          {
            id: uid("ct"),
            at: order.createdAt,
            label: "Pagamento confirmado (demo)",
          },
        ],
      };

      const nextDb: CustomerAccountDb = {
        ...db,
        orders: [customerOrder, ...db.orders],
      };

      const written = tryWriteDb(nextDb);
      if (!written.ok) {
        return {
          status: "failed",
          error:
            "Não foi possível salvar o pedido na sua conta. O carrinho foi mantido — tente novamente.",
        };
      }

      setDb(nextDb);
      return { status: "created", orderId: customerOrder.code };
    },
    [db, isHydrated],
  );

  const submitReview = useCallback(
    (input: { id: string; rating: number; comment: string }) => {
      if (!db) return;
      persist({
        ...db,
        reviews: db.reviews.map((review) =>
          review.id === input.id
            ? {
                ...review,
                rating: input.rating,
                comment: input.comment.trim(),
                status: "published",
                updatedAt: new Date().toISOString(),
              }
            : review,
        ),
      });
    },
    [db, persist],
  );

  const createReturn = useCallback(
    (input: {
      orderId: string;
      itemProductIds: string[];
      reason: string;
      description: string;
    }): { ok: true } | { ok: false; error: string } => {
      if (!db) return { ok: false, error: "Conta indisponível." };
      const order = db.orders.find((item) => item.id === input.orderId);
      if (!order) return { ok: false, error: "Pedido não encontrado." };
      if (order.status !== "delivered") {
        return {
          ok: false,
          error: "Somente pedidos entregues podem solicitar devolução.",
        };
      }
      if (input.itemProductIds.length === 0) {
        return { ok: false, error: "Selecione ao menos um item." };
      }
      if (!input.reason.trim() || !input.description.trim()) {
        return { ok: false, error: "Informe motivo e descrição." };
      }

      const request: CustomerReturnRequest = {
        id: uid("cret"),
        orderId: order.id,
        orderCode: order.code,
        itemProductIds: input.itemProductIds,
        reason: input.reason.trim(),
        description: input.description.trim(),
        status: "requested",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      persist({ ...db, returns: [request, ...db.returns] });
      return { ok: true };
    },
    [db, persist],
  );

  const createSupportTicket = useCallback(
    (input: { category: string; subject: string; message: string }) => {
      const ticket: CustomerSupportTicket = {
        id: uid("ctkt"),
        protocol: `SUP-${Date.now().toString().slice(-8)}`,
        category: input.category,
        subject: input.subject.trim(),
        message: input.message.trim(),
        status: "open",
        createdAt: new Date().toISOString(),
      };
      if (db) {
        persist({ ...db, tickets: [ticket, ...db.tickets] });
      }
      return ticket;
    },
    [db, persist],
  );

  const value = useMemo<AccountDataContextValue>(
    () => ({
      db,
      isHydrated,
      favorites,
      favoritesLoading,
      toggleFavorite,
      isFavorite,
      saveAddress,
      removeAddress,
      setDefaultAddress,
      appendOrderFromCheckout,
      submitReview,
      createReturn,
      createSupportTicket,
    }),
    [
      appendOrderFromCheckout,
      createReturn,
      createSupportTicket,
      db,
      favorites,
      favoritesLoading,
      isFavorite,
      isHydrated,
      removeAddress,
      saveAddress,
      setDefaultAddress,
      submitReview,
      toggleFavorite,
    ],
  );

  return (
    <AccountDataContext.Provider value={value}>
      {children}
    </AccountDataContext.Provider>
  );
}

export function useAccountData(): AccountDataContextValue {
  const context = useContext(AccountDataContext);
  if (!context) {
    throw new Error("useAccountData deve ser usado dentro de AccountDataProvider.");
  }
  return context;
}
