import { expect, test, type Page } from "@playwright/test";
import { credentialsOrThrow, hasCredentials, loginAs } from "./helpers/session";

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
] as const;

/**
 * Rotas reais do admin (ADMIN_NAV, src/data/admin.ts). Integrações,
 * Repasses, Relatórios, Configurações e Entregas saíram do menu e
 * respondem 404 de propósito (ligadas à decisão de gateway de pagamento
 * ainda em aberto — ver status-migracao-microservicos.md, "4 telas mock
 * do admin escondidas").
 */
const ADMIN_ROUTES = [
  "/admin",
  "/admin/vendedores",
  "/admin/produtos",
  "/admin/catalogo",
  "/admin/cupons",
  "/admin/pedidos",
  "/admin/financeiro",
  "/admin/clientes",
  "/admin/devolucoes",
  "/admin/conteudos",
  "/admin/administradores",
] as const;

/** Rotas reais de /minha-conta (ACCOUNT_NAV, src/data/account.ts). */
const ACCOUNT_ROUTES = [
  "/minha-conta",
  "/minha-conta/pedidos",
  "/minha-conta/devolucoes",
  "/minha-conta/enderecos",
  "/minha-conta/favoritos",
  "/minha-conta/avaliacoes",
  "/minha-conta/cupons",
  "/minha-conta/configuracoes",
  "/minha-conta/ajuda",
] as const;

function uniqueSuffix() {
  return Date.now().toString(36);
}

async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

async function waitForAccessHydration(page: Page) {
  await page.goto("/acesso");
  await expect(page.locator('[data-access-hydrated="true"]')).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("storefront busca e âncoras", () => {
  test.beforeEach(async ({ page }) => {
    await clearSession(page);
  });

  test("busca da loja abre CommandDialog e navega para produto", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Abrir busca da loja" });
    await expect(trigger).toContainText("Buscar produtos, livros, incensos...");
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Busca da loja" });
    await expect(dialog).toBeVisible();
    const input = page.getByRole("combobox", { name: "Termo da busca da loja" });
    await expect(input).toHaveAttribute(
      "placeholder",
      "Buscar produtos, livros, incensos...",
    );
    await input.fill("japamala");
    const option = dialog.getByRole("option").first();
    await expect(option).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/produto\//);
  });

  test("links absolutos para seções da home e rotas de catálogo", async ({
    page,
  }) => {
    await page.goto("/carrinho");
    await expect(page.locator('a[href="/catalogo"]').first()).toHaveAttribute(
      "href",
      "/catalogo",
    );

    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Conhecer categorias" }),
    ).toHaveAttribute("href", "/#categorias");
    await page.goto("/#categorias");
    await expect(page.locator("#categorias")).toBeVisible();
  });
});

test.describe("vendedor /loja", () => {
  test.beforeEach(() => {
    test.skip(
      !hasCredentials("seller"),
      "requer E2E_SELLER_EMAIL/E2E_SELLER_PASSWORD (loja ACTIVE)",
    );
  });

  test("login vendedor redireciona para /loja", async ({ page }) => {
    const creds = credentialsOrThrow("seller");
    await clearSession(page);
    await waitForAccessHydration(page);
    await page.getByLabel("E-mail", { exact: true }).fill(creds.email);
    await page.locator('input[type="password"]').fill(creds.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/loja$/, { timeout: 15_000 });
  });

  test("protege /loja sem sessão", async ({ page }) => {
    await clearSession(page);
    await page.goto("/loja");
    await expect(page).toHaveURL(/\/acesso/, { timeout: 15_000 });
  });

  /**
   * Substitui o teste antigo "isolamento sellerId em pedido alheio", que
   * dependia de `createAdminSeed()` pra achar um pedido de outra loja —
   * não existe mais dado seed pra pedido real. Precisa de duas contas de
   * vendedor de teste conhecidas (E2E_SELLER_EMAIL e uma segunda loja) e
   * do id de um pedido real da SEGUNDA loja, nenhum dos dois disponível
   * por padrão — pulado até serem configurados, em vez de inventar um id.
   */
  test("isolamento: pedido de outra loja não abre no detalhe", async ({
    page,
    context,
  }) => {
    test.skip(
      !process.env.E2E_OTHER_SELLER_ORDER_ID,
      "requer E2E_OTHER_SELLER_ORDER_ID (id de SellerOrder de uma loja diferente de E2E_SELLER_EMAIL)",
    );
    await loginAs(context, "seller");
    await page.goto(`/loja/pedidos/${process.env.E2E_OTHER_SELLER_ORDER_ID}`);
    await expect(page.getByRole("heading", { name: /indisponível/i })).toBeVisible();
  });

  test("publica/despublica produto do vendedor", async ({ page, context }) => {
    await loginAs(context, "seller");
    await page.goto("/loja/produtos");
    await expect(page.getByRole("heading", { name: "Produtos" })).toBeVisible();
    const firstProduct = page.locator("table a").first();
    await firstProduct.click();
    await expect(page).toHaveURL(/\/loja\/produtos\//);

    const toggleButton = page.getByRole("button", {
      name: /^(Publicar|Despublicar)$/,
    });
    await expect(toggleButton).toBeVisible();
    const initialLabel = await toggleButton.textContent();
    await toggleButton.click();
    await expect(toggleButton).not.toHaveText(initialLabel ?? "", {
      timeout: 15_000,
    });
    // Volta ao estado original pra não deixar o produto de teste mudado
    // de status como efeito colateral do teste.
    await toggleButton.click();
    await expect(toggleButton).toHaveText(initialLabel ?? "", {
      timeout: 15_000,
    });
  });

  test("cria produto novo", async ({ page, context }) => {
    await loginAs(context, "seller");
    await page.goto("/loja/produtos/novo");

    const suffix = uniqueSuffix();
    await page.getByLabel("Título").fill(`Produto E2E ${suffix}`);
    await page
      .getByLabel("Categoria")
      .selectOption({ index: 1 }); // primeira opção real após o placeholder
    await page.getByLabel("Preço (R$)").fill("49.90");
    await page.getByLabel("SKU").fill(`E2E-${suffix}`);
    await page.getByLabel("Estoque").fill("3");

    await page.getByRole("button", { name: "Criar produto" }).click();
    await expect(page).toHaveURL(/\/loja\/produtos\//, { timeout: 15_000 });
  });

  test("muda estoque na tela dedicada", async ({ page, context }) => {
    await loginAs(context, "seller");
    await page.goto("/loja/estoque");
    const input = page.locator('input[id^="stk-"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    const original = await input.inputValue();
    await input.fill("7");
    await page.getByRole("button", { name: "Salvar" }).first().click();
    await expect(page.getByText(/Estoque atualizado/i)).toBeVisible();
    // Restaura o valor original pra não deixar o estoque real alterado
    // como efeito colateral do teste.
    if (original && original !== "7") {
      await input.fill(original);
      await page.getByRole("button", { name: "Salvar" }).first().click();
      await expect(page.getByText(/Estoque atualizado/i)).toBeVisible();
    }
  });

  test("pedidos do vendedor", async ({ page, context }) => {
    await loginAs(context, "seller");
    await page.goto("/loja/pedidos");
    await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
  });
});

test.describe("conta do cliente", () => {
  test.beforeEach(() => {
    test.skip(
      !hasCredentials("customer"),
      "requer E2E_CUSTOMER_EMAIL/E2E_CUSTOMER_PASSWORD",
    );
  });

  test("rotas principais da conta", async ({ page, context }) => {
    await loginAs(context, "customer");
    for (const route of ACCOUNT_ROUTES) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, "\\/")));
    }
  });

  /**
   * Substitui "histórico de pedidos lista seed" (dependia do pedido mock
   * POT-2026-0042, que não existe mais). Sem um número de pedido real
   * conhecido de antemão, o teste confirma que a lista carrega — real ou
   * vazia, ambos são estados válidos pra uma conta de teste qualquer.
   * Defina E2E_CUSTOMER_ORDER_NUMBER pra também conferir um pedido
   * específico.
   */
  test("histórico de pedidos carrega", async ({ page, context }) => {
    await loginAs(context, "customer");
    await page.goto("/minha-conta/pedidos");
    await expect(page.getByRole("heading", { name: "Meus Pedidos" })).toBeVisible({
      timeout: 15_000,
    });
    const orderNumber = process.env.E2E_CUSTOMER_ORDER_NUMBER;
    if (orderNumber) {
      await expect(
        page.getByRole("link", { name: new RegExp(orderNumber) }).last(),
      ).toBeVisible();
    }
  });

  test("endereço CRUD básico", async ({ page, context }) => {
    await loginAs(context, "customer");
    await page.goto("/minha-conta/enderecos");
    await page.getByLabel("Rótulo").fill("Temporário E2E");
    await page.getByLabel("Destinatário").fill("Cliente Demo");
    await page.getByLabel("Rua").fill("Rua Teste");
    await page.getByLabel("Número").fill("10");
    await page.getByLabel("Bairro").fill("Centro");
    await page.getByLabel("Cidade").fill("São Paulo");
    await page.getByLabel("UF").fill("SP");
    await page.getByLabel("CEP").fill("01000-000");
    await page.getByRole("button", { name: "Adicionar endereço" }).click();
    await expect(page.getByText(/Endereço adicionado/i)).toBeVisible();
  });

  test("favorito remover na conta", async ({ page, context }) => {
    await loginAs(context, "customer");
    await page.goto("/minha-conta/favoritos");
    const remove = page.getByRole("button", { name: "Remover" }).first();
    if (await remove.count()) {
      await remove.click();
    }
    await expect(page.getByRole("heading", { name: "Favoritos" })).toBeVisible();
  });

  test("avaliações — lista carrega", async ({ page, context }) => {
    await loginAs(context, "customer");
    await page.goto("/minha-conta/avaliacoes");
    await expect(page.getByRole("heading", { name: "Avaliações" })).toBeVisible();
  });

  /**
   * `/minha-conta/devolucoes` virou só leitura (o formulário de
   * solicitação mudou pra `/minha-conta/pedidos/[id]`, ver
   * status-migracao-microservicos.md) — o teste antigo preenchia um
   * formulário que não existe mais nesta tela.
   */
  test("devoluções — lista carrega", async ({ page, context }) => {
    await loginAs(context, "customer");
    await page.goto("/minha-conta/devolucoes");
    await expect(page.getByRole("heading", { name: "Devoluções" })).toBeVisible();
  });
});

test.describe("admin rotas e modal", () => {
  test.beforeEach(() => {
    test.skip(
      !hasCredentials("admin"),
      "requer E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD",
    );
  });

  test("todas as rotas admin principais", async ({ page, context }) => {
    await loginAs(context, "admin");
    for (const route of ADMIN_ROUTES) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, "\\/")));
    }
  });

  /**
   * Substitui "AdminModal Novo vendedor" — esse botão não existe mais
   * (não há `POST /admin/sellers`, ver status-migracao-microservicos.md).
   * O modal de "Novo administrador" (`/admin/administradores`, feature
   * mais recente do projeto) segue exatamente o mesmo `AdminModal`
   * compartilhado, então cobre a mesma superfície de acessibilidade
   * (foco, Escape, clique no backdrop, scroll lock) sem inventar uma
   * ação que o backend não tem. Nunca submete o formulário — só testa o
   * comportamento do modal em si, pra não criar um admin de verdade a
   * cada rodada de teste.
   */
  test("AdminModal Novo administrador: visível, foco, Escape e backdrop", async ({
    page,
    context,
  }) => {
    await loginAs(context, "admin");
    await page.goto("/admin/administradores");
    await expect(
      page.getByRole("heading", { name: "Administradores" }),
    ).toBeVisible({ timeout: 15_000 });

    const openButton = page.getByRole("button", { name: "Novo administrador" });
    await expect(openButton).toBeVisible();
    await openButton.click();

    const dialog = page.getByRole("dialog", { name: "Novo administrador" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Novo administrador" }),
    ).toBeVisible();

    const focusInside = await page.evaluate(() => {
      const active = document.activeElement;
      const el = document.querySelector('[role="dialog"]');
      return Boolean(el && active && el.contains(active));
    });
    expect(focusInside).toBe(true);

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.y).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(openButton).toBeFocused();

    await openButton.click();
    await expect(dialog).toBeVisible();

    // Clique no canto da viewport atinge o Overlay (positioner tem pointer-events: none).
    await page.mouse.click(8, 8);
    await expect(dialog).toBeHidden();

    const scrollLockCleared = await page.evaluate(() => {
      const body = document.body;
      const overflow = getComputedStyle(body).overflow;
      const lockedAttr = body.getAttribute("data-scroll-locked");
      return overflow !== "hidden" && lockedAttr == null;
    });
    expect(scrollLockCleared).toBe(true);
  });
});

test.describe("home — overflow horizontal por viewport", () => {
  // Sem sessão nenhuma — roda sempre, independente de credenciais de teste.
  for (const viewport of VIEWPORTS) {
    test(`sem overflow horizontal em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await clearSession(page);
      await page.goto("/");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow).toBeFalsy();
    });
  }
});
