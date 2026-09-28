import { CatalogListing } from "@/components/catalog/CatalogListing";
import { parseProductSortOrder, parseSearchQuery, sortProducts } from "@/features/catalog/selectors";
import { listPublicProducts, toStorefrontProduct } from "@/lib/api/catalog-public";

/**
 * Rewritten this session (vitrine pública real, ver
 * status-migracao-microservicos.md) — antes usava `isNew`, um campo que
 * não existe em `Product` no catalog-service (produto ativo é publicado
 * uma vez, sem data de lançamento separada do `createdAt`). "Novidades"
 * agora significa exatamente o que a home já usa pra "Produtos em
 * destaque" há sessões: os produtos publicados mais recentemente
 * (`GET /public/products` já ordena por `createdAt desc` por padrão, ver
 * `ProductsService.listPublished`) — dado real, não uma curadoria
 * inventada.
 */
export const metadata = {
  title: "Novidades | Instituto Potala Marketplace",
  description: "Produtos publicados mais recentemente no Instituto Potala.",
};

export default async function NovidadesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const query = parseSearchQuery(sp.q);
  const order = parseProductSortOrder(sp.ordem);

  const page = await listPublicProducts({ q: query || undefined, limit: 40 });
  const products = sortProducts(page.items.map((item) => toStorefrontProduct(item)), order);

  return (
    <CatalogListing
      title="Novidades"
      description="Produtos publicados mais recentemente."
      products={products}
      categories={[]}
      breadcrumb={[
        { label: "Início", href: "/" },
        { label: "Novidades" },
      ]}
      currentQuery={query}
      currentOrder={order}
      showCategoryFilter={false}
      emptyActionHref="/novidades"
      emptyActionLabel="Limpar filtros de novidades"
    />
  );
}
