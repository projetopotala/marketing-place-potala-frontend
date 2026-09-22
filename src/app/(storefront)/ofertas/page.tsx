import { CatalogListing } from "@/components/catalog/CatalogListing";
import {
  filterProductsByQuery,
  getDiscountPercent,
  getOfferProducts,
  parseProductSortOrder,
  parseSearchQuery,
  sortProducts,
} from "@/features/catalog/selectors";
import { formatPrice } from "@/data/marketplace";

export const metadata = {
  title: "Ofertas | Instituto Potala Marketplace",
  description:
    "Produtos com preço original maior que o preço atual no catálogo demonstrativo.",
};

export default async function OfertasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const query = parseSearchQuery(sp.q);
  const order = parseProductSortOrder(sp.ordem);
  let products = getOfferProducts();
  products = filterProductsByQuery(products, query);
  products = sortProducts(products, order);

  const offerSummary =
    products.length > 0
      ? `Itens com desconto calculado a partir do preço original. Ex.: ${products
          .slice(0, 2)
          .map((p) => {
            const pct = getDiscountPercent(p);
            return `${p.name} (${formatPrice(p.price)}${pct != null ? `, −${pct}%` : ""})`;
          })
          .join("; ")}.`
      : "Somente produtos com preço original finito e maior que o preço atual.";

  return (
    <CatalogListing
      title="Ofertas"
      description={`Produtos em oferta no catálogo público demonstrativo. ${offerSummary}`}
      products={products}
      categories={[]}
      breadcrumb={[
        { label: "Início", href: "/" },
        { label: "Ofertas" },
      ]}
      currentQuery={query}
      currentOrder={order}
      showCategoryFilter={false}
      emptyActionHref="/ofertas"
      emptyActionLabel="Limpar filtros de ofertas"
    />
  );
}
