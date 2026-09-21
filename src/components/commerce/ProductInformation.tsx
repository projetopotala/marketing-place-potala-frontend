import type { Product } from "@/types/marketplace";
import { StarIcon } from "@/components/storefront/icons";
import { formatPrice } from "@/data/marketplace";
import styles from "./ProductInformation.module.css";

interface ProductInformationProps {
  product: Product;
}

export function ProductInformation({ product }: ProductInformationProps) {
  return (
    <div className={styles.info}>
      <p className={styles.category}>{product.category}</p>
      <h1 className={styles.title}>{product.name}</h1>

      {product.reviewCount > 0 ? (
        <div
          className={styles.rating}
          aria-label={`Avaliação ${product.rating} de 5 com ${product.reviewCount} avaliações`}
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <StarIcon
              key={`${product.id}-info-star-${index}`}
              className="h-4 w-4"
              filled={index < Math.round(product.rating)}
            />
          ))}
          <span className={styles.ratingMeta}>
            {product.rating.toFixed(1)} · {product.reviewCount} avaliações
            {product.soldCount ? ` · ${product.soldCount} vendidos` : null}
          </span>
        </div>
      ) : (
        // Real products have no review model yet (see catalog-public.ts) —
        // mirrors ProductCard's "Sem avaliações" treatment instead of
        // showing a hollow "0.0 · 0 avaliações" line.
        <p className={styles.ratingMeta}>Sem avaliações</p>
      )}

      {product.sku ? <p className={styles.sku}>SKU: {product.sku}</p> : null}

      {product.description ? (
        <p className={styles.lead}>{product.description}</p>
      ) : null}

      <div className={styles.priceMobile}>
        <span>{formatPrice(product.price)}</span>
        {product.originalPrice ? (
          <span className={styles.original}>{formatPrice(product.originalPrice)}</span>
        ) : null}
      </div>
    </div>
  );
}
