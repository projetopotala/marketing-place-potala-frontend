import { notFound } from "next/navigation";
import { CatalogListing } from "@/components/catalog/CatalogListing";
import { parseProductSortOrder, parseSearchQuery, sortProducts } from "@/features/catalog/selectors";
import {
  listPublicCategories,
  listPublicProducts,
  toStorefrontProduct,
} from "@/lib/api/catalog-public";

/**
 * Rewritten this session (Fase 1 do plano até 05/10) — real categorias,
 * no mais a lista estática de 7 categorias editoriais. Category slugs ARE
 * globally unique (`Category.slug @unique`, catalog-service's
 * schema.prisma), unlike Product.slug, so this route can safely stay
 * slug-based. No `generateStaticParams`: categories are created
 * dynamically by the admin now, so this is a normal dynamic route.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categories = await listPublicCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) {
    return { title: "Categoria não encontrada | Instituto Potala Marketplace" };
  }
  return {
    title: `${category.name} | Instituto Potala Marketplace`,
    description: `Produtos da categoria ${category.name} no Instituto Potala.`,
  };
}

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const categories = await listPublicCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) {
    notFound();
  }

  const sp = await searchParams;
  const query = parseSearchQuery(sp.q);
  const order = parseProductSortOrder(sp.ordem);

  const page = await listPublicProducts({
    categoryId: category.id,
    q: query || undefined,
    limit: 60,
  });
  const products = sortProducts(page.items.map((item) => toStorefrontProduct(item)), order);

  return (
    <CatalogListing
      title={category.name}
      description={`Produtos da categoria ${category.name}.`}
      products={products}
      categories={categories}
      breadcrumb={[
        { label: "Início", href: "/" },
        { label: "Catálogo", href: "/catalogo" },
        { label: category.name },
      ]}
      currentQuery={query}
      currentOrder={order}
      currentCategoryId={category.id}
      lockedCategoryId={category.id}
      showCategoryFilter={false}
      emptyActionHref={`/categoria/${category.slug}`}
      emptyActionLabel={`Limpar filtros de ${category.name}`}
    />
  );
}
