import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { apiFetch } from "@/lib/api/client";
import { API_BASE_URL } from "@/lib/api/config";
import type { Paginated, PublicCategory, PublicProduct } from "@/lib/api/catalog-public";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  // Fail on API errors so an incomplete catalog is not cached as a successful sitemap.
  const categories = await apiFetch<PublicCategory[]>("/public/categories", {
    signal: AbortSignal.timeout(20000),
  });
  const urls = new Set(["/", "/catalogo", "/novidades"]);
  for (const category of categories ?? []) {
    urls.add(`/categoria/${encodeURIComponent(category.slug)}`);
  }

  let cursor: string | null = null;
  const cursors = new Set<string>();
  do {
    const query = new URLSearchParams({ limit: "60" });
    if (cursor) query.set("cursor", cursor);
    const page = await apiFetch<Paginated<PublicProduct>>(`/public/products?${query}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (!page) throw new Error("Catalog returned no sitemap data");
    for (const product of page.items) urls.add(`/produto/${encodeURIComponent(product.id)}`);
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.nextCursor;
    if (!cursor || cursors.has(cursor)) throw new Error("Invalid catalog pagination");
    cursors.add(cursor);
  } while (cursor);

  return [...urls].map((path) => ({ url: new URL(path, SITE_URL).href }));
}

const cachedSitemap = unstable_cache(buildSitemap, ["public-sitemap", SITE_URL, API_BASE_URL], {
  revalidate: 3600,
});

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return cachedSitemap();
}
