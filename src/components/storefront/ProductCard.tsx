"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState, type MouseEvent } from "react";
import { Heart } from "lucide-react";
import type { Product } from "@/types/marketplace";
import { formatPrice } from "@/data/marketplace";
import {
  getDiscountPercent,
  isOnOffer,
} from "@/features/catalog/selectors";
import {
  ArrowRightIcon,
  CartIcon,
  StarIcon,
} from "@/components/storefront/icons";
import { useAccountData } from "@/features/account/AccountDataContext";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

interface ProductCardProps {
  product: Product;
  compact?: boolean;
  tone?: "dark" | "light";
}

export function ProductCard({
  product,
  compact = false,
  tone = "dark",
}: ProductCardProps) {
  const isDetails = product.action === "details";
  const actionLabel = isDetails ? "Ver detalhes" : "Adicionar ao carrinho";
  const isLight = tone === "light";
  const href = `/produto/${product.slug}`;
  const { user } = useAuth();
  const { isFavorite, toggleFavorite, isHydrated } = useAccountData();
  const { addItem, isReady, items } = useCart();
  const [feedback, setFeedback] = useState<string | null>(null);
  const statusId = useId();
  const favorite =
    user?.role === "customer" && isHydrated
      ? isFavorite(product.id)
      : false;

  const stock = Math.floor(product.stock ?? 0);
  const inCart = items.find((item) => item.productId === product.id);
  const remaining =
    Number.isFinite(stock) && stock > 0
      ? Math.max(0, stock - (inCart?.quantity ?? 0))
      : 0;
  const canAdd =
    isReady && !isDetails && stock > 0 && remaining > 0;
  const onOffer = isOnOffer(product);
  const discountPercent = getDiscountPercent(product);
  const hasReviews = product.reviewCount > 0;

  function handleAddToCart(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!canAdd) {
      setFeedback(
        stock < 1
          ? `${product.name} indisponível no momento.`
          : `Limite de estoque atingido para ${product.name}.`,
      );
      return;
    }

    // Produtos vindos do catalog-service real sempre têm ao menos 1
    // variante (CreateProductDto exige >= 1) — defaultVariantId só fica
    // undefined pra dado mock/legado que não passou por toStorefrontProduct().
    if (!product.defaultVariantId) {
      setFeedback(`${product.name} está sem variante cadastrada e não pode ser comprado no momento.`);
      return;
    }

    const added = addItem({
      productId: product.id,
      variantId: product.defaultVariantId,
      slug: product.slug,
      name: product.name,
      category: product.category,
      imageSrc: product.imageSrc,
      unitPrice: product.price,
      stock,
      quantity: 1,
    });

    if (added) {
      setFeedback(`${product.name} adicionado ao carrinho.`);
    } else {
      setFeedback(`Não foi possível adicionar ${product.name} ao carrinho.`);
    }
  }

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden border transition ${
        compact
          ? "w-[11.5rem] shrink-0 sm:w-52"
          : "featured-product-card w-full min-w-0"
      } ${
        isLight
          ? "rounded-[0.55rem] border-[rgb(4_17_38_/_12%)] bg-white/75 shadow-[0_10px_24px_rgb(4_17_38_/_8%)]"
          : compact
            ? "rounded-[0.55rem] border-potala-border bg-potala-panel"
            : ""
      }`}
    >
      {user?.role === "customer" ? (
        <button
          type="button"
          className="absolute right-2 top-2 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-potala-border bg-potala-bg/80 text-potala-gold"
          aria-label={
            favorite
              ? `Remover ${product.name} dos favoritos`
              : `Adicionar ${product.name} aos favoritos`
          }
          aria-pressed={favorite}
          onClick={() =>
            toggleFavorite({
              productId: product.id,
              slug: product.slug,
              name: product.name,
              imageSrc: product.imageSrc,
              price: product.price,
            })
          }
        >
          <Heart
            size={18}
            strokeWidth={1.7}
            fill={favorite ? "currentColor" : "none"}
            aria-hidden="true"
          />
        </button>
      ) : null}

      <Link
        href={href}
        className={`relative overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-potala-gold ${
          compact ? "aspect-square" : "aspect-[4/3]"
        }`}
      >
        <Image
          src={product.imageSrc}
          alt={product.name}
          fill
          className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          sizes={
            compact
              ? "(max-width: 639px) 70vw, 208px"
              : "(max-width: 639px) 82vw, (max-width: 899px) 46vw, (max-width: 1279px) 31vw, 18vw"
          }
        />
        {product.badge || onOffer ? (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-[0.3rem] bg-potala-gold px-2 py-[0.2rem] text-[0.7rem] font-semibold leading-none text-potala-bg">
            {onOffer && discountPercent != null
              ? `−${discountPercent}%`
              : product.badge}
          </span>
        ) : null}
      </Link>

      <div
        className={`flex flex-1 flex-col ${
          compact ? "gap-1.5 p-3" : "gap-2 px-3.5 pb-3.5 pt-3"
        }`}
      >
        <p
          className={`text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${
            isLight ? "text-[color:var(--potala-bg)]/60" : "text-potala-gold"
          }`}
        >
          {product.category}
        </p>

        <h3
          className={`font-medium leading-snug ${
            compact
              ? "min-h-[2.5rem] text-sm"
              : "min-h-[2.6rem] text-[0.95rem] md:text-[1rem]"
          } ${isLight ? "text-potala-bg" : "text-potala-cream"}`}
        >
          <Link
            href={href}
            className="line-clamp-2 transition hover:text-potala-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-potala-gold"
          >
            {product.name}
          </Link>
        </h3>

        {hasReviews ? (
          <div
            className="flex items-center gap-0.5 text-potala-gold"
            aria-label={`Avaliação ${product.rating} de 5 com ${product.reviewCount} avaliações`}
          >
            {Array.from({ length: 5 }).map((_, index) => (
              <StarIcon
                key={`${product.id}-star-${index}`}
                className="h-3 w-3"
                filled={index < Math.round(product.rating)}
              />
            ))}
            <span
              className={`ml-1 text-[0.7rem] ${
                isLight ? "text-[color:var(--potala-bg)]/55" : "text-potala-muted"
              }`}
            >
              ({product.reviewCount})
            </span>
          </div>
        ) : (
          <p
            className={`text-[0.7rem] ${
              isLight ? "text-[color:var(--potala-bg)]/55" : "text-potala-muted"
            }`}
          >
            Sem avaliações
          </p>
        )}

        <div className="mt-auto">
          {onOffer && product.originalPrice != null ? (
            <p
              className={`text-[0.75rem] line-through ${
                isLight ? "text-[color:var(--potala-bg)]/45" : "text-potala-muted"
              }`}
            >
              {formatPrice(product.originalPrice)}
            </p>
          ) : null}
          <p
            className={`font-bold ${
              compact ? "text-base" : "text-[1.1rem] md:text-[1.15rem]"
            } ${isLight ? "text-potala-bg" : "text-potala-cream"}`}
          >
            {formatPrice(product.price)}
          </p>
        </div>

        {isDetails ? (
          <Link
            href={href}
            className={`mt-1 inline-flex w-full items-center gap-2 rounded-[0.375rem] border border-potala-gold/55 bg-transparent px-3 text-[0.8rem] font-semibold text-potala-gold transition hover:border-potala-gold-light hover:bg-potala-gold/10 hover:text-potala-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-potala-gold-light ${
              compact ? "min-h-11 justify-center" : "min-h-11 justify-center"
            } ${
              isLight
                ? "border-[color:var(--potala-bg)]/25 text-[color:var(--potala-bg)] hover:bg-[color:var(--potala-bg)]/5"
                : ""
            }`}
            aria-label={`${actionLabel}: ${product.name}`}
          >
            <span>{actionLabel}</span>
            <ArrowRightIcon className="h-4 w-4 shrink-0" />
          </Link>
        ) : (
          <button
            type="button"
            className={`mt-1 inline-flex w-full items-center gap-2 rounded-[0.375rem] border border-potala-gold/55 bg-transparent px-3 text-[0.8rem] font-semibold text-potala-gold transition hover:border-potala-gold-light hover:bg-potala-gold/10 hover:text-potala-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-potala-gold-light disabled:cursor-not-allowed disabled:opacity-50 ${
              compact ? "min-h-11 justify-between" : "min-h-11 justify-between"
            } ${
              isLight
                ? "border-[color:var(--potala-bg)]/25 text-[color:var(--potala-bg)] hover:bg-[color:var(--potala-bg)]/5"
                : ""
            }`}
            aria-label={`${actionLabel}: ${product.name}`}
            aria-describedby={statusId}
            disabled={!canAdd}
            onClick={handleAddToCart}
          >
            <CartIcon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">
              {!isReady
                ? "Carregando…"
                : stock < 1
                  ? "Indisponível"
                  : remaining < 1
                    ? "Estoque no carrinho"
                    : actionLabel}
            </span>
            <ArrowRightIcon className="h-4 w-4 shrink-0" />
          </button>
        )}

        <p
          id={statusId}
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {feedback}
        </p>
      </div>
    </article>
  );
}
