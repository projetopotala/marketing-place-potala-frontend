import { ProductImage } from "@/components/commerce/ProductImage";
import Link from "next/link";
import type { CompactProduct } from "@/types/marketplace";
import { formatPrice } from "@/data/marketplace";
import { StarIcon } from "@/components/storefront/icons";

interface CompactProductCardProps {
  product: CompactProduct;
}

export function CompactProductCard({ product }: CompactProductCardProps) {
  const hasReviews = product.reviewCount > 0;

  return (
    <Link
      href={product.href}
      className="discovery-compact-card group block min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-potala-gold"
    >
      <div className="relative aspect-[6/5] overflow-hidden rounded-[0.65rem]">
        <ProductImage
          src={product.imageSrc}
          alt={product.name}
          fill
          sizes="(max-width: 767px) 44vw, (max-width: 1179px) 22vw, 11vw"
          className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </div>

      <h4 className="mt-2 min-h-[2.35rem] line-clamp-2 text-[0.8125rem] font-medium leading-[1.3] text-potala-bg">
        {product.name}
      </h4>

      <p className="mt-1 text-[0.875rem] font-semibold text-potala-bg">
        {formatPrice(product.price)}
      </p>

      {hasReviews ? (
        <div
          className="mt-1 flex items-center gap-0.5 text-potala-gold"
          aria-label={`Avaliação ${product.rating} de 5 com ${product.reviewCount} avaliações`}
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <StarIcon
              key={`${product.id}-star-${index}`}
              className="h-2.5 w-2.5"
              filled={index < Math.round(product.rating)}
            />
          ))}
          <span className="ml-0.5 text-[0.625rem] text-[color:var(--potala-bg)]/55">
            ({product.reviewCount})
          </span>
        </div>
      ) : (
        <p className="mt-1 text-[0.625rem] text-[color:var(--potala-bg)]/55">
          Sem avaliações
        </p>
      )}
    </Link>
  );
}
