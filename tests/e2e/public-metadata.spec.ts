import { expect, test } from "@playwright/test";
import { SITE_URL } from "../../src/lib/site";

test("robots e sitemap publicam URLs públicas da origem correta", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const directives = await robots.text();
  expect(directives).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  expect(directives).toContain("Disallow: /admin");

  const sitemap = await request.get("/sitemap.xml", { timeout: 60000 });
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toContain("xml");
  const xml = await sitemap.text();
  expect(xml).toContain(`<loc>${SITE_URL}/catalogo</loc>`);
  expect(xml).not.toContain("/admin");
  expect(xml).not.toContain("/checkout");
});

test("home tem canonical e dados estruturados e recupera foto quebrada", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", SITE_URL);
  const schema = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(JSON.parse(schema ?? "{}")["@type"]).toBe("WebSite");

  const image = page.locator(".featured-product-card img").first();
  await expect(image).toBeVisible();
  await image.scrollIntoViewIfNeeded();
  await page.route("**/audit-broken-product.png", (route) => route.abort());
  await image.evaluate((element) => {
    const image = element as HTMLImageElement;
    image.removeAttribute("srcset");
    image.src = "/audit-broken-product.png";
  });
  await expect(image).toHaveAttribute("src", "/images/potala/product-unavailable.svg");
  await expect(image).toHaveAttribute("alt", /imagem indisponível/);
  await expect.poll(
    () => image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    { timeout: 15000 },
  ).toBeGreaterThan(0);
});
