import Link from "next/link";
import { FeaturedProductsCarousel } from "@/components/storefront/FeaturedProductsCarousel";
import { ArrowRightIcon } from "@/components/storefront/icons";
import { listPublicProducts, toStorefrontProduct } from "@/lib/api/catalog-public";

/**
 * Rewritten this session (Fase 1 do plano até 05/10) — produtos reais
 * (GET /public/products) em vez do mock. `Product.featured` existe no
 * schema do catalog-service, mas não há hoje nenhum endpoint pra ativá-lo
 * (mesmo gap do "sem upload de imagem") — então "destaque" aqui significa
 * "publicados mais recentemente", não uma curadoria manual. Revisitar
 * quando/se `featured` ganhar um jeito de ser definido pelo vendedor/admin.
 */
export async function FeaturedProducts() {
  const page = await listPublicProducts({ limit: 8 });
  const products = page.items.map((item) => toStorefrontProduct(item));

  if (products.length === 0) {
    return null;
  }

  return (
    <section
      id="produtos"
      aria-labelledby="featured-products-heading"
      className="scroll-mt-28 bg-potala-bg py-9 md:py-11"
    >
      <div className="featured-products-container">
        <div className="mb-6 flex items-center justify-between gap-4 md:mb-7">
          <div className="flex min-w-0 items-center gap-3">
            <h2
              id="featured-products-heading"
              className="font-serif text-[1.625rem] font-semibold leading-none text-potala-cream md:text-[1.8rem]"
            >
              Produtos em destaque
            </h2>
            <span aria-hidden="true" className="product-heading-ornament" />
          </div>

          <Link
            href="/catalogo"
            className="inline-flex min-h-11 shrink-0 items-center gap-2.5 text-sm text-potala-cream/90 transition hover:text-potala-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-potala-gold-light"
          >
            Ver todos
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-potala-gold/45 text-potala-gold"
            >
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>

        <FeaturedProductsCarousel products={products} />
      </div>
    </section>
  );
}
