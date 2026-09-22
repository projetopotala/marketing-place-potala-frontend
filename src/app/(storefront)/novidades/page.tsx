import { CatalogListing } from "@/components/catalog/CatalogListing";
import {
  filterProductsByQuery,
  getNewArrivalProducts,
  parseProductSortOrder,
  parseSearchQuery,
  sortProducts,
} from "@/features/catalog/selectors";

export const metadata = {
  title: "Novidades | Instituto Potala Marketplace",
  description:
    "Seleção editorial demonstrativa de novidades do Instituto Potala.",
};

export default async function NovidadesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const query = parseSearchQuery(sp.q);
  const order = parseProductSortOrder(sp.ordem);
  let products = getNewArrivalProducts();
  products = filterProductsByQuery(products, query);
  products = sortProducts(products, order);

  return (
    <CatalogListing
      title="Novidades"
      description="Seleção editorial demonstrativa marcada com isNew — não usa datas de lançamento inventadas."
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
