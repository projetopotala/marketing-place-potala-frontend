import { expect, test, type Page } from "@playwright/test";
import { createAdminSeed } from "../../src/features/admin/data/seed";
import { credentialsOrThrow, hasCredentials, loginAs } from "./helpers/session";

const PUBLIC_ROUTES = [
  "/",
  "/acesso",
  "/carrinho",
  "/checkout",
  "/produto/japamala",
] as const;

/**
 * A busca administrativa global (Command+K no AdminTopbar) continua sobre
 * `AdminDataContext`/`createAdminSeed()` — esse recurso não foi migrado
 * pra dado real (ver status-migracao-microservicos.md), então o seed
 * ainda é a fonte de verdade pra esse teste especificamente, mesmo com a
 * sessão que dá acesso à tela já sendo real.
 */
const ADMIN_SEED_SELLER = createAdminSeed().sellers.find(
  (seller) => seller.id === "sel-1",
);

if (!ADMIN_SEED_SELLER) {
  throw new Error("Seed administrativo sem vendedor sel-1.");
}

async function waitForAccessHydration(page: Page) {
  await page.goto("/acesso");
  await expect(page.locator('[data-access-hydrated="true"]')).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("rotas públicas", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`abre ${route} sem overflow horizontal`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      expect(overflow).toBeFalsy();
    });
  }
});

test.describe("área autenticada (sessão real)", () => {
  test.beforeEach(() => {
    test.skip(
      !hasCredentials("admin"),
      "requer E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD",
    );
  });

  test("login admin redireciona para /admin", async ({ page }) => {
    const creds = credentialsOrThrow("admin");
    await waitForAccessHydration(page);
    await page.getByLabel("E-mail", { exact: true }).fill(creds.email);
    await page.locator('input[type="password"]').fill(creds.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Painel/i })).toBeVisible();
  });

  test("rotas admin principais respondem", async ({ page, context }) => {
    await loginAs(context, "admin");

    for (const route of [
      "/admin",
      "/admin/vendedores",
      "/admin/produtos",
      "/admin/pedidos",
      "/admin/financeiro",
    ]) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, "\\/")));
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      expect(overflow).toBeFalsy();
    }
  });

  test("busca administrativa global com CommandDialog", async ({
    page,
    context,
  }) => {
    await loginAs(context, "admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Painel/i })).toBeVisible();

    const searchTrigger = page.getByRole("button", {
      name: "Abrir busca administrativa",
    });
    const expectedRoute = `/admin/vendedores/${ADMIN_SEED_SELLER.id}`;
    const searchTerm = "Ervas Sagradas";

    await page.keyboard.press("Control+KeyK");
    const searchDialog = page.getByRole("dialog", { name: "Busca administrativa" });
    await expect(searchDialog).toBeVisible();

    await page.keyboard.press("Control+KeyK");
    await expect(searchDialog).toBeHidden();
    await expect(searchTrigger).toBeFocused();

    await page.keyboard.press("Control+KeyK");
    await expect(searchDialog).toBeVisible();

    const searchInput = page.getByRole("combobox", {
      name: "Termo da busca administrativa",
    });
    await expect(searchInput).toBeFocused();
    await searchInput.fill(searchTerm);

    const result = searchDialog.getByRole("option", {
      name: new RegExp(ADMIN_SEED_SELLER.name, "i"),
    });
    await expect(result).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(
      new RegExp(expectedRoute.replace(/\//g, "\\/")),
    );

    await page.goto("/admin");
    await expect(searchTrigger).toBeVisible();
    await searchTrigger.click();
    await expect(searchDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(searchDialog).toBeHidden();
    await expect(searchTrigger).toBeFocused();
  });
});

test.describe("minha conta (sessão real)", () => {
  test.beforeEach(() => {
    test.skip(
      !hasCredentials("customer"),
      "requer E2E_CUSTOMER_EMAIL/E2E_CUSTOMER_PASSWORD",
    );
  });

  test("minha-conta com cliente", async ({ page, context }) => {
    await loginAs(context, "customer");
    await page.goto("/minha-conta");
    await expect(page).toHaveURL(/\/minha-conta/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: "Resumo da Conta" }),
    ).toBeVisible();
  });
});
