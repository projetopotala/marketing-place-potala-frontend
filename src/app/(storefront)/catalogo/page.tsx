import { CatalogListing } from "@/components/catalog/CatalogListing";
import {
  parseProductSortOrder,
  parseSearchQuery,
  sortProducts,
} from "@/features/catalog/selectors";
import {
  listPublicCategories,
  listPublicProducts,
  toStorefrontProduct,
} from "@/lib/api/catalog-public";

export const metadata = {
  title: "Catálogo | Instituto Potala Marketplace",
  description: "Explore o catálogo do Instituto Potala Marketplace.",
};

/**
 * Rewritten this session (Fase 1 do plano até 05/10) to use real data —
 * see catalog-public.ts. Server Component: these are public,
 * unauthenticated endpoints, so a plain server-side fetch works both
 * locally and once the backend is deployed (Fase 4 do mesmo plano), with
 * no client-side loading state needed.
 *
 * "Coleções editoriais" (colecao=mais-procurados) and "ordem=relevancia"
 * as anything but "newest first" don't have a real backing concept in the
 * catalog-service data model, so the "colecao" query param from the old
 * mock version is dropped here — sort by price/name still works (real
 * fields), "relevancia" just means "as returned by the API" (newest
 * first).
 */
export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parseSearchQuery(params.q);
  const order = parseProductSortOrder(params.ordem);
  const rawCategoryParam = Array.isArray(params.categoria)
    ? params.categoria[0]
    : params.categoria;

  const [categories, page] = await Promise.all([
    listPublicCategories(),
    listPublicProducts({ limit: 60, q: query || undefined }),
  ]);

  const selectedCategory = rawCategoryParam
    ? categories.find((category) => category.id === rawCategoryParam)
    : undefined;

  let products = page.items.map(toStorefrontProduct);
  if (selectedCategory) {
    products = products.filter((p) => p.categoryId === selectedCategory.id);
  }
  products = sortProducts(products, order);

  const title = selectedCategory ? selectedCategory.name : "Catálogo";
  const description = selectedCategory
    ? `Produtos da categoria ${selectedCategory.name}.`
    : "Todos os produtos publicados no Instituto Potala.";

  return (
    <CatalogListing
      title={title}
      description={description}
      products={products}
      categories={categories}
      breadcrumb={[
        { label: "Início", href: "/" },
        { label: "Catálogo", href: "/catalogo" },
        ...(selectedCategory ? [{ label: selectedCategory.name }] : []),
      ]}
      currentQuery={query}
      currentOrder={order}
      currentCategoryId={selectedCategory?.id}
      showCategoryFilter
      emptyActionHref="/catalogo"
    />
  );
}
