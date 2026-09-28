import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SellerStorefrontView } from "@/components/storefront/SellerStorefrontView";
import { getPublicSellerBySlug } from "@/lib/api/sellers-public";
import { listPublicProducts, toStorefrontProduct } from "@/lib/api/catalog-public";
import { getSellerRatingSummary } from "@/lib/api/reviews";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Rewritten this session (vitrine pública real, ver
 * status-migracao-microservicos.md) — antes rodava 100% sobre
 * `createAdminSeed()` (seed mock administrativo), nunca tinha sido ligada
 * a dado real de vendedor/produto. Sem `generateStaticParams`: lojas são
 * criadas dinamicamente (cadastro de vendedor), mesma razão já registrada
 * em `categoria/[slug]/page.tsx` pra categorias.
 *
 * `coverImageSrc` não existe no backend (sem upload de capa nesta v1,
 * mesmo gap já documentado pra imagem de produto) — usa o mesmo fallback
 * genérico de sempre. Sem bloco de "produtos em destaque desta loja" com
 * curadoria manual (não existe endpoint pra isso, mesmo raciocínio de
 * "featured" já usado no resto do catálogo): usa os produtos com
 * `featured: true` da própria loja, que é dado real.
 *
 * Avaliação da loja vem de `getSellerRatingSummary` (orders-service, Fase
 * B), não de `Seller.ratingAverage` (sellers-service) — esse campo nunca é
 * escrito em nenhum fluxo real (sempre 0, `@default(0)` no schema), então
 * usá-lo mostraria "Avaliação 0.0" pra toda loja, parecendo nota ruim em
 * vez de "sem avaliação ainda". O agregado real de `Review` já existe e é
 * o mesmo usado na página de produto.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const seller = await getPublicSellerBySlug(slug);
  if (!seller) {
    return { title: "Loja não encontrada | Instituto Potala" };
  }

  return {
    title: `${seller.tradeName} | Instituto Potala Marketplace`,
    description:
      seller.description ??
      `Conheça os produtos da loja ${seller.tradeName} no Instituto Potala.`,
  };
}

export default async function SellerPublicStorePage({ params }: PageProps) {
  const { slug } = await params;
  const seller = await getPublicSellerBySlug(slug);
  if (!seller) notFound();

  const [page, ratingSummary] = await Promise.all([
    listPublicProducts({ sellerId: seller.id, limit: 60 }),
    getSellerRatingSummary(seller.id),
  ]);
  const products = page.items.map((item) => toStorefrontProduct(item));
  const featured = products.filter((product) => product.featured).slice(0, 4);
  const categories = [
    ...new Set(products.map((product) => product.category)),
  ];

  return (
    <SellerStorefrontView
      sellerName={seller.tradeName}
      sellerDescription={
        seller.description ??
        "Loja parceira do Instituto Potala com produtos selecionados."
      }
      sellerRating={ratingSummary.average}
      sellerReviewCount={ratingSummary.count}
      coverImageSrc="/images/potala/hero-bg-v2.png"
      categories={categories}
      products={products}
      featured={featured}
    />
  );
}
