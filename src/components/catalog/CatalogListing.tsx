import { ProductCard } from "@/components/storefront/ProductCard";
import {
  CatalogToolbar,
  type CatalogToolbarCategory,
} from "@/components/catalog/CatalogToolbar";
import { FadeIn } from "@/components/ui/motion/FadeIn";
import {
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/motion/StaggerContainer";
import type { ProductSortOrder } from "@/features/catalog/selectors";
import type { Product } from "@/types/marketplace";
import Link from "next/link";
import { Suspense } from "react";

export interface CatalogBreadcrumbItem {
  label: string;
  href?: string;
}

interface CatalogListingProps {
  title: string;
  description: string;
  products: Product[];
  breadcrumb: CatalogBreadcrumbItem[];
  currentQuery: string;
  currentOrder: ProductSortOrder;
  currentCategoryId?: string;
  lockedCategoryId?: string;
  lockedCollection?: string;
  showCategoryFilter?: boolean;
  emptyActionHref?: string;
  emptyActionLabel?: string;
  demoNote?: string;
  /** Real categories for the filter dropdown — see CatalogToolbarCategory. */
  categories: CatalogToolbarCategory[];
}

function ToolbarFallback() {
  return (
    <div
      className="min-h-[8rem] animate-pulse rounded-md border border-potala-border bg-potala-panel/40"
      aria-hidden="true"
    />
  );
}

export function CatalogListing({
  title,
  description,
  products,
  breadcrumb,
  currentQuery,
  currentOrder,
  currentCategoryId,
  lockedCategoryId,
  lockedCollection,
  showCategoryFilter = true,
  emptyActionHref = "/catalogo",
  emptyActionLabel = "Ver todos os produtos",
  demoNote = "Catálogo do Instituto Potala — produtos publicados pelos vendedores.",
  categories,
}: CatalogListingProps) {
  return (
    <div className="catalog-listing potala-wide-container py-8 md:py-10">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-potala-muted">
        <ol className="flex flex-wrap items-center gap-2">
          {breadcrumb.map((item, index) => {
            const isLast = index === breadcrumb.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className="text-potala-cream/85 transition hover:text-potala-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-potala-gold"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={isLast ? "page" : undefined}>
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <FadeIn>
        <header className="mb-6 max-w-3xl">
          <h1 className="font-serif text-[1.85rem] font-semibold leading-tight text-potala-cream md:text-[2.15rem]">
            {title}
          </h1>
          <p className="mt-3 text-[1rem] leading-relaxed text-potala-muted">
            {description}
          </p>
          <p className="mt-2 text-xs text-potala-muted/80">{demoNote}</p>
        </header>
      </FadeIn>

      <Suspense fallback={<ToolbarFallback />}>
        <CatalogToolbar
          resultCount={products.length}
          currentQuery={currentQuery}
          currentOrder={currentOrder}
          currentCategoryId={currentCategoryId}
          lockedCategoryId={lockedCategoryId}
          lockedCollection={lockedCollection}
          showCategoryFilter={showCategoryFilter}
          categories={categories}
        />
      </Suspense>

      {products.length === 0 ? (
        <div
          className="mt-8 rounded-md border border-dashed border-potala-border bg-potala-panel/40 px-5 py-10 text-center"
          role="status"
        >
          <p className="text-potala-cream">
            Nenhum produto corresponde aos filtros atuais.
          </p>
          <Link
            href={emptyActionHref}
            className="potala-btn potala-btn-secondary mt-5 inline-flex min-h-11"
          >
            {emptyActionLabel}
          </Link>
        </div>
      ) : (
        <StaggerContainer className="catalog-product-grid mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <StaggerItem key={product.id} className="h-full min-w-0">
              <ProductCard product={product} />
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </div>
  );
}
