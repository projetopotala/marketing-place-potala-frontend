import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ADMIN_STORAGE_KEY } from "../../src/features/admin/data/seed";

/**
 * Reescrito nesta sessão. O arquivo original foi construído inteiro em
 * cima do catálogo mock fixo de 7 categorias × 2 produtos cada
 * (`EXPECTED_BY_CATEGORY`/`CATALOG_CATEGORIES`, `src/features/catalog/
 * categories.ts`) e de produtos específicos criados só pra demonstrar o
 * fluxo de "correção de descoberta" (`NEW_PRODUCT_SLUGS`/
 * `DISCOVERY_FIXES`: curso-chakras, kit-aromatico-lavanda, etc.). A Fase 1
 * do plano até 05/10 (ver status-migracao-microservicos.md) substituiu
 * `/categoria/[slug]`, `FeaturedCategories`, `FeaturedProducts` e
 * `DiscoverySections` por dado real (`GET /public/categories`,
 * `GET /public/products`) — nenhum desses produtos/categorias de mock
 * existe mais no banco real, e o catálogo real de produção tem hoje só
 * um punhado de produtos (bem menos que os 14 do mock antigo, ver seção
 * "Teste completo em produção" do status do projeto).
 *
 * `/ofertas` também saiu do ar de propósito nesta mesma fase — vira um
 * 404 real (`notFound()`), não uma página com heading "Ofertas" (decisão
 * do Arthur: não existe preço promocional real no backend).
 *
 * Removidos sem substituto direto (testavam 100% dado de mock que não
 * existe mais em lugar nenhum do sistema real):
 * - "dados canônicos: ids/slugs únicos, ≥2 por categoria e assets" —
 *   validava a lista fixa de 7 categorias e assets locais de imagem
 *   (`discovery-*-final.png`) específicos de produtos removidos.
 * - "discovery: quatro links antes trocados apontam ao produto certo" —
 *   `DISCOVERY_FIXES` apontava pra slugs de produto que só existiam no
 *   mock (`curso-chakras`, `kit-aromatico-lavanda`, ...).
 * - "detalhes dos novos produtos batem com nome/preço" — mesmo motivo
 *   (`NEW_PRODUCT_SLUGS`).
 * - "curso mostra programa e não frete físico" — usava
 *   `/produto/curso-chakras`, slug que não existe no catalog-service
 *   real; não há hoje nenhum produto de curso real conhecido/garantido
 *   pra reconstruir esse teste sem inventar dado.
 *
 * O que sobrou foi reescrito em dois eixos:
 * - Estrutura de navegação (menu Categorias, CTAs do hero, a11y, URL de
 *   filtros) continua fixa — é comportamento 100% frontend, não migrado
 *   e não dependente de quais produtos existem hoje.
 * - As 4 categorias do cabeçalho (Livros/Incensos/Cristais/Acessórios,
 *   `HEADER_CATEGORY_SLUGS`) são taxonomia permanente do design (imagens
 *   sob medida por nome em `FeaturedCategories`), não dado de demonstração
 *   — `cristais` foi inclusive confirmada como categoria real existente
 *   pelo próprio Arthur em teste ponta a ponta ("`/categoria/cristais`
 *   corretamente vazia"), então os testes que só verificam que a página
 *   da categoria carrega (heading, sem 404) continuam usando esses slugs
 *   fixos. Nenhum teste abaixo afirma mais qual produto específico
 *   aparece dentro de uma categoria ou busca — isso agora é descoberto
 *   dinamicamente a partir do que o catálogo real tiver no momento.
 */

const WIDTHS = [360, 390, 768, 1024, 1440] as const;
const STABLE_ROUTES = ["/", "/catalogo", "/novidades", "/carrinho", "/categoria/cristais"] as const;

async function measureHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflow: doc.scrollWidth - doc.clientWidth,
    };
  });
}

/**
 * Primeiro produto real do catálogo (`GET /public/products` via
 * `/catalogo`) — usado pelos testes de busca/carrinho abaixo em vez de um
 * nome fixo, já que o inventário real muda e não é garantido ter nenhum
 * produto específico do mock antigo.
 */
async function firstCatalogProduct(
  page: Page,
): Promise<{ card: Locator; name: string } | null> {
  await page.goto("/catalogo");
  const cards = page.locator("article").filter({
    has: page.getByRole("heading", { level: 3 }),
  });
  const count = await cards.count();
  if (count === 0) return null;
  const card = cards.first();
  const name = (await card.getByRole("heading", { level: 3 }).innerText()).trim();
  return { card, name };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("navegação e catálogo público", () => {
  test("menu Categorias abre, navega e fecha (desktop e mobile)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const desktopNav = page.getByRole("navigation", { name: "Categorias" });
    await expect(desktopNav.getByRole("link", { name: "Livros", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Incensos", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Cristais", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Acessórios", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Novidades", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Cursos", exact: true })).toHaveCount(0);
    await expect(desktopNav.getByRole("link", { name: "Terapias", exact: true })).toHaveCount(0);
    await expect(desktopNav.getByRole("link", { name: "Meditação", exact: true })).toHaveCount(0);

    const trigger = page.getByRole("button", { name: "Categorias" });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    const disclosureList = desktopNav
      .getByRole("link", { name: "Ver todos os produtos" })
      .locator("xpath=ancestor::ul[1]");
    await expect(disclosureList.getByRole("link", { name: "Livros", exact: true })).toBeVisible();
    await expect(disclosureList.getByRole("link", { name: "Incensos", exact: true })).toBeVisible();
    await expect(disclosureList.getByRole("link", { name: "Cristais", exact: true })).toBeVisible();
    await expect(disclosureList.getByRole("link", { name: "Acessórios", exact: true })).toBeVisible();
    await expect(disclosureList.getByRole("link", { name: "Cursos", exact: true })).toHaveCount(0);
    await expect(disclosureList.getByRole("link", { name: "Terapias", exact: true })).toHaveCount(0);
    await expect(disclosureList.getByRole("link", { name: "Meditação", exact: true })).toHaveCount(0);

    await disclosureList.getByRole("link", { name: "Cristais", exact: true }).click();
    await expect(page).toHaveURL(/\/categoria\/cristais/);
    await expect(page.getByRole("heading", { level: 1, name: "Cristais" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menu de categorias" }).click();
    const mobileNav = page.getByRole("navigation", { name: "Categorias móveis" });
    await expect(mobileNav.getByRole("link", { name: "Livros", exact: true })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Cursos", exact: true })).toHaveCount(0);
    await expect(mobileNav.getByRole("link", { name: "Terapias", exact: true })).toHaveCount(0);
    await expect(mobileNav.getByRole("link", { name: "Meditação", exact: true })).toHaveCount(0);
    await mobileNav.getByRole("link", { name: "Livros", exact: true }).click();
    await expect(page).toHaveURL(/\/categoria\/livros/);
    await expect(page.getByRole("heading", { level: 1, name: "Livros" })).toBeVisible();
  });

  test("cards de categoria e CTAs do hero / Ver todos", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Explorar categoria Cristais/i }).click();
    await expect(page).toHaveURL(/\/categoria\/cristais/);

    await page.goto("/");
    await page.getByRole("link", { name: "Explorar produtos" }).click();
    await expect(page).toHaveURL(/\/catalogo$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Conhecer categorias" }).click();
    await expect(page.locator("#categorias")).toBeVisible();

    await page.goto("/");
    await page
      .locator("#produtos")
      .getByRole("link", { name: /Ver todos/i })
      .click();
    await expect(page).toHaveURL(/\/catalogo$/);

    await page.goto("/");
    await page
      .locator("#novidades")
      .getByRole("link", { name: /Ver todos/i })
      .click();
    await expect(page).toHaveURL(/\/novidades/);
  });

  test("categoria inexistente → not found; rotas diretas e reload", async ({
    page,
  }) => {
    const response = await page.goto("/categoria/nao-existe-xyz");
    expect(response?.status()).toBe(404);

    await page.goto("/categoria/cristais");
    await expect(page.getByRole("heading", { level: 1, name: "Cristais" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Cristais" })).toBeVisible();
  });

  test("ofertas foi removida do ar (404 real)", async ({ page }) => {
    // Ver comentário no topo do arquivo — decisão do Arthur, sem preço
    // promocional real no backend pra sustentar essa página.
    const response = await page.goto("/ofertas");
    expect(response?.status()).toBe(404);
  });

  test("filtros na URL: busca, ordenação, reload e voltar", async ({ page }) => {
    const product = await firstCatalogProduct(page);
    test.skip(!product, "catálogo real sem nenhum produto no momento");
    const term = product!.name.split(/\s+/)[0];

    await page.goto("/catalogo");
    await page.getByLabel("Buscar").fill(term);
    await page.getByRole("button", { name: "Aplicar busca" }).click();
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(term)}`, "i"));
    await expect(
      page.getByRole("heading", { name: new RegExp(escapeRegExp(term), "i") }).first(),
    ).toBeVisible();

    await page.getByLabel("Ordenar").selectOption("menor-preco");
    await expect(page).toHaveURL(/ordem=menor-preco/);
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(term)}`, "i"));

    await page.reload();
    await expect(page.getByLabel("Buscar")).toHaveValue(term);
    await expect(page.getByLabel("Ordenar")).toHaveValue("menor-preco");

    await page.goto("/catalogo?q=xyzsemresultado999");
    await expect(page.getByText(/Nenhum produto corresponde/i)).toBeVisible();

    await page.goto(`/catalogo?q=${encodeURIComponent(term)}`);
    await page.goto("/catalogo?q=outronaoexistente999");
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(term)}`, "i"));
  });

  test("busca é insensível a maiúsculas/minúsculas e novidades mostra produtos reais", async ({
    page,
  }) => {
    const product = await firstCatalogProduct(page);
    test.skip(!product, "catálogo real sem nenhum produto no momento");
    const term = product!.name.split(/\s+/)[0];

    await page.goto(`/catalogo?q=${encodeURIComponent(term.toLowerCase())}`);
    await expect(
      page.getByRole("heading", { name: new RegExp(escapeRegExp(term), "i") }).first(),
    ).toBeVisible();
    await page.goto(`/catalogo?q=${encodeURIComponent(term.toUpperCase())}`);
    await expect(
      page.getByRole("heading", { name: new RegExp(escapeRegExp(term), "i") }).first(),
    ).toBeVisible();

    await page.goto("/novidades");
    await expect(page.getByRole("heading", { level: 1, name: "Novidades" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("carrinho: add da vitrine, quantidade, persistência", async ({ page }) => {
    const product = await firstCatalogProduct(page);
    test.skip(!product, "catálogo real sem nenhum produto no momento");
    const { card, name } = product!;

    await card.getByRole("button", { name: /Adicionar ao carrinho/i }).click();
    await expect(page.getByRole("link", { name: /Carrinho com 1/i })).toBeVisible();

    await card.getByRole("button", { name: /Adicionar ao carrinho/i }).click();
    await expect(page.getByRole("link", { name: /Carrinho com 2/i })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("link", { name: /Carrinho com 2/i })).toBeVisible();

    await page.goto("/carrinho");
    await expect(page.getByText(name)).toBeVisible();
  });

  test("vitrine não reseta banco admin V2 personalizado", async ({ page }) => {
    const customMarker = "vendedor-custom-vitrine-check";
    await page.addInitScript(
      ({ key, marker }) => {
        const existing = window.localStorage.getItem(key);
        if (existing) {
          try {
            const parsed = JSON.parse(existing) as { settings?: { storeName?: string } };
            if (parsed?.settings) {
              parsed.settings.storeName = marker;
              window.localStorage.setItem(key, JSON.stringify(parsed));
              return;
            }
          } catch {
            // fall through to seed-like minimal marker bag
          }
        }
        window.localStorage.setItem(
          key,
          JSON.stringify({
            version: 2,
            updatedAt: new Date().toISOString(),
            settings: { storeName: marker },
            sellers: [],
            products: [],
            orders: [],
            shipments: [],
            transactions: [],
            payouts: [],
            customers: [],
            contents: [],
            coupons: [],
            categories: [],
            attributes: [],
            gateways: [],
            notifications: [],
          }),
        );
      },
      { key: ADMIN_STORAGE_KEY, marker: customMarker },
    );

    await page.goto("/catalogo");
    await expect(page.getByRole("heading", { level: 1, name: "Catálogo" })).toBeVisible();
    await page.goto("/categoria/cristais");
    await expect(page.getByRole("heading", { level: 1, name: "Cristais" })).toBeVisible();

    const stored = await page.evaluate((key) => window.localStorage.getItem(key), ADMIN_STORAGE_KEY);
    expect(stored).toBeTruthy();
    expect(stored).toContain(customMarker);
  });

  test("a11y menu Escape + reduced motion + overflow", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Categorias" });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of STABLE_ROUTES) {
        await page.goto(route);
        const overflow = await measureHorizontalOverflow(page);
        expect(overflow.overflow, `${route} @ ${width}`).toBeLessThanOrEqual(1);
      }
    }
  });

  test("screenshots home/catalogo/novidades/menu", async ({ page }) => {
    test.setTimeout(90_000);
    const resolvedOutDir = path.join(process.cwd(), "test-results", "storefront-nav");
    fs.mkdirSync(resolvedOutDir, { recursive: true });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.screenshot({
      path: path.join(resolvedOutDir, "home-desktop-after.png"),
      fullPage: false,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Categorias" }).click();
    await page.screenshot({
      path: path.join(resolvedOutDir, "menu-desktop-open-after.png"),
      fullPage: false,
      animations: "disabled",
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.screenshot({
      path: path.join(resolvedOutDir, "home-mobile-after.png"),
      fullPage: false,
      animations: "disabled",
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/catalogo");
    await page.screenshot({
      path: path.join(resolvedOutDir, "catalogo-desktop-after.png"),
      fullPage: false,
      animations: "disabled",
    });
    await page.goto("/novidades");
    await page.screenshot({
      path: path.join(resolvedOutDir, "novidades-desktop-after.png"),
      fullPage: false,
      animations: "disabled",
    });
    await page.goto("/categoria/cristais");
    await page.screenshot({
      path: path.join(resolvedOutDir, "categoria-cristais-desktop-after.png"),
      fullPage: false,
      animations: "disabled",
    });

    for (const file of [
      "home-desktop-after.png",
      "home-mobile-after.png",
      "catalogo-desktop-after.png",
      "novidades-desktop-after.png",
      "menu-desktop-open-after.png",
    ]) {
      const full = path.join(resolvedOutDir, file);
      expect(fs.existsSync(full)).toBeTruthy();
      expect(fs.statSync(full).size).toBeGreaterThan(5_000);
    }
  });
});
