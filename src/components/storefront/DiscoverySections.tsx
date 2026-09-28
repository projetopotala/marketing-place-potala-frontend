import { CompactProductCard } from "@/components/storefront/CompactProductCard";
import { ArrowRightIcon } from "@/components/storefront/icons";
import type { CompactProduct } from "@/types/marketplace";
import { listPublicProducts, toStorefrontProduct } from "@/lib/api/catalog-public";
import Link from "next/link";

/**
 * Rewritten this session (vitrine pública, ver
 * status-migracao-microservicos.md). Era um componente 100% mock com dois
 * carrosséis curados à mão ("Mais procurados"/"Novidades", IDs hardcoded
 * em features/catalog/selectors.ts, apontando pra produtos do catálogo
 * antigo que nem existem mais no backend real).
 *
 * "Mais procurados" foi removido (decisão do Arthur via AskUserQuestion) —
 * não existe rastreamento de busca nem de venda por produto no backend
 * hoje, não havia como tornar essa seção real sem inventar dado (mesma
 * classe de gap já documentada pra /ofertas).
 *
 * "Novidades" virou real: produtos publicados mais recentemente
 * (GET /public/products, ordem padrão createdAt desc), mesma semântica já
 * usada pela página /novidades — só que aqui mostrando uma amostra menor,
 * pensada pra home.
 */
function toCompactProduct(product: ReturnType<typeof toStorefrontProduct>): CompactProduct {
  return {
    id: product.id,
    name: product.name,
    imageSrc: product.imageSrc,
    price: product.price,
    rating: product.rating,
    reviewCount: product.reviewCount,
    href: `/produto/${product.id}`,
  };
}

export async function DiscoverySections() {
  const page = await listPublicProducts({ limit: 8 });
  const products = page.items.map((item) => toCompactProduct(toStorefrontProduct(item)));

  if (products.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="discovery-novidades-title" className="discovery-section">
      <div className="discovery-container">
        <div id="novidades" className="discovery-group min-w-0 scroll-mt-28">
          <div className="discovery-group-header">
            <h2
              id="discovery-novidades-title"
              className="font-serif text-[1.45rem] font-semibold leading-none text-potala-bg md:text-[1.7rem]"
            >
              Novidades
            </h2>
            <Link
              href="/novidades"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 text-[0.8125rem] text-potala-gold transition hover:text-[color:var(--potala-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-potala-gold"
            >
              Ver todos
              <span
                aria-hidden="true"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-potala-gold/40 text-potala-gold"
              >
                <ArrowRightIcon className="h-3 w-3" />
              </span>
            </Link>
          </div>

          <div className="discovery-product-grid">
            {products.map((product) => (
              <CompactProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
