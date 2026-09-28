/**
 * Seletores puros do catálogo público (fonte: PRODUCTS em marketplace.ts).
 * Não leem localStorage administrativo.
 */

import { PRODUCTS } from "@/data/marketplace";
import {
  getCatalogCategory,
  isCatalogCategoryId,
  type CatalogCategoryId,
} from "@/features/catalog/categories";
import { textIncludes } from "@/lib/normalizeText";
import type { Product } from "@/types/marketplace";

export const PRODUCT_SORT_ORDERS = [
  "relevancia",
  "menor-preco",
  "maior-preco",
  "nome",
] as const;

export type ProductSortOrder = (typeof PRODUCT_SORT_ORDERS)[number];

export function listProductsByCategory(categoryId: string): Product[] {
  if (!isCatalogCategoryId(categoryId)) return [];
  return PRODUCTS.filter((product) => product.categoryId === categoryId);
}

export function countProductsByCategory(categoryId: CatalogCategoryId): number {
  return listProductsByCategory(categoryId).length;
}

export function filterProductsByQuery(
  products: readonly Product[],
  query: string,
): Product[] {
  const q = query.trim();
  if (!q) return [...products];

  return products.filter(
    (product) =>
      textIncludes(product.name, q) ||
      textIncludes(product.category, q) ||
      textIncludes(product.description ?? "", q) ||
      textIncludes(product.longDescription ?? "", q) ||
      textIncludes(product.slug, q),
  );
}

export function isOnOffer(product: Product): boolean {
  return (
    typeof product.originalPrice === "number" &&
    Number.isFinite(product.originalPrice) &&
    product.originalPrice > product.price &&
    Number.isFinite(product.price) &&
    product.price > 0
  );
}

export function getDiscountPercent(product: Product): number | null {
  if (!isOnOffer(product) || product.originalPrice == null) return null;
  return Math.round(
    (1 - product.price / product.originalPrice) * 100,
  );
}

export function getOfferProducts(
  products: readonly Product[] = PRODUCTS,
): Product[] {
  return products.filter(isOnOffer);
}

export function getNewArrivalProducts(
  products: readonly Product[] = PRODUCTS,
): Product[] {
  return products.filter((product) => product.isNew === true);
}

export function parseProductSortOrder(
  value: string | string[] | undefined,
): ProductSortOrder {
  const raw = Array.isArray(value) ? value[0] : value;
  if (
    raw &&
    (PRODUCT_SORT_ORDERS as readonly string[]).includes(raw)
  ) {
    return raw as ProductSortOrder;
  }
  return "relevancia";
}

export function parseCategoryFilter(
  value: string | string[] | undefined,
): CatalogCategoryId | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && isCatalogCategoryId(raw)) return raw;
  return undefined;
}

export function parseSearchQuery(
  value: string | string[] | undefined,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Ordem editorial padrão = ordem do array PRODUCTS. */
export function sortProducts(
  products: readonly Product[],
  order: ProductSortOrder,
): Product[] {
  const list = [...products];

  switch (order) {
    case "menor-preco":
      return list.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, "pt-BR"));
    case "maior-preco":
      return list.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name, "pt-BR"));
    case "nome":
      return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    case "relevancia":
    default:
      return list;
  }
}

/**
 * "colecao" (coleção editorial "mais-procurados") foi removido nesta
 * sessão — sem métrica real de busca/venda por produto no backend, era
 * um param morto (o /catalogo já tinha abandonado o conceito antes; a
 * home ainda usava via DiscoverySections, ver status-migracao-microservicos.md).
 */
export function buildCatalogSearchParams(input: {
  q?: string;
  ordem?: ProductSortOrder;
  categoria?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  const q = input.q?.trim();
  if (q) params.set("q", q);
  if (input.ordem && input.ordem !== "relevancia") {
    params.set("ordem", input.ordem);
  }
  if (input.categoria && isCatalogCategoryId(input.categoria)) {
    params.set("categoria", input.categoria);
  }
  return params;
}

export function catalogHref(input: {
  pathname?: string;
  q?: string;
  ordem?: ProductSortOrder;
  categoria?: string;
}): string {
  const pathname = input.pathname ?? "/catalogo";
  const params = buildCatalogSearchParams(input);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function categoryBreadcrumbHref(categoryId: string): string {
  const category = getCatalogCategory(categoryId);
  return category?.href ?? "/catalogo";
}

export function isCourseProduct(product: Product): boolean {
  return product.modality === "course" || product.action === "details";
}
