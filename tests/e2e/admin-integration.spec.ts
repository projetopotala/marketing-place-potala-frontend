import { test, expect, type Page } from "@playwright/test";

const date = new Date().toISOString();
const product = { id: "product-real", sellerId: "seller-real", categoryId: "category-real", title: "Produto da API", description: "Descrição real", slug: "produto", priceCents: 10000, status: "ACTIVE", featured: false, createdAt: date, updatedAt: date, variants: [{ id: "v1", name: "Padrão", sku: "SKU1", inventory: { quantity: 8, reservedQuantity: 0 } }] };
const seller = { id: "seller-real", tradeName: "Loja da API", legalName: "Loja real", documentType: "CNPJ", documentNumber: "123", slug: "loja", email: "seller@example.test", status: "ACTIVE", statusReason: null, commissionBps: 1000, createdAt: date };
const order = { id: "seller-order-real", orderId: "order-real", sellerId: seller.id, status: "CONFIRMED", subtotalCents: 10000, commissionCents: 1000, sellerNetCents: 9000, financialSnapshot: { version: 1, lines: [] }, createdAt: date, updatedAt: date, items: [{ productId: product.id, productTitle: product.title, quantity: 1, lineTotalCents: 10000 }], order: { orderNumber: "PEDIDO-API", status: "PAID", createdAt: date, shippingAddress: { recipient: "Cliente da API", city: "São Paulo", state: "SP" } } };
const paginated = (items: unknown[]) => ({ items, pageInfo: { hasNextPage: false, nextCursor: null } });

test("vitrine mantém cabeçalho areia e não oferece links de Cursos", async ({ page }) => {
  await page.route("**/api/v1/**", route => route.fulfill({
    status: route.request().url().includes("/auth/me") ? 401 : 200,
    contentType: "application/json", body: JSON.stringify(paginated([])),
  }));
  await page.goto("/eventos");
  await expect(page.locator('a[href="/cursos"], a[href="/categoria/cursos"]')).toHaveCount(0);
  await expect(page.locator("#topo")).toHaveCSS("background-color", "rgb(245, 240, 230)");
  await expect(page.getByRole("heading", { name: "Eventos", exact: true })).toBeVisible();
});

async function fixture(page: Page, failOrders = false) {
  const mutations: string[] = [];
  await page.addInitScript(() => localStorage.setItem("potala-analytics-consent-v1", "rejected"));
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^.*\/api\/v1/, "");
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (request.method() !== "GET") mutations.push(`${request.method()} ${path}`);
    let body: unknown = paginated([]);
    if (path === "/auth/me") body = { user: { id: "admin-real", email: "admin@example.test", roles: ["ADMIN"], status: "ACTIVE", createdAt: date }, profile: { id: "profile-real", fullName: "Admin teste", phone: null }, admin: { id: "admin-real" }, customer: null };
    else if (path === "/admin/sellers") body = paginated([seller]);
    else if (path === "/admin/products") body = paginated([product]);
    else if (path.endsWith("/deactivate")) body = { ...product, status: "INACTIVE" };
    else if (path === "/admin/categories") body = [{ id: "category-real", name: "Categoria da API", status: "ACTIVE" }];
    else if (path === "/admin/orders") {
      if (failOrders) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Pedidos indisponíveis" }) });
      body = paginated([order]);
    } else if (path === "/admin/customers") body = paginated([{ id: "customer-real", fullName: "Cliente da API", email: "client@example.test", phone: null, status: "ACTIVE", createdAt: date }]);
    else if (path === "/admin/contents") body = paginated([{ id: "content-real", title: "Curso da API", instructor: "Instrutor", category: "Curso", status: "DRAFT", format: "TEXT", priceCents: 1000, description: "Curso", createdAt: date, updatedAt: date }]);
    else if (path === "/admin/reports") body = [{ key: "sales", label: "Vendas", scoped: true }];
    else if (path === "/admin/finance/policies") body = [];
    else if (path === "/admin/coupons") body = paginated([]);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return mutations;
}

test("dashboard antigo usa APIs e paleta atual sem seed", async ({ page }, testInfo) => {
  await fixture(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Painel do Marketplace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Desempenho de Vendas", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top produtos", exact: true })).toBeVisible();
  await expect(page.getByText("Produto da API · 1 un.")).toBeVisible();
  await page.getByLabel("Período do gráfico").selectOption("7");
  await expect(page.getByText(/Vendas e gráficos: últimos 7 dias/)).toBeVisible();
  expect(await page.locator("body").evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--potala-navy-800").trim())).toBe("#efdfbf");
  expect(await page.evaluate(() => localStorage.getItem("potala-admin-demo-db-v2"))).toBeNull();
  await expect(page.getByText("Loja da API", { exact: true }).first()).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    const charts = page.getByRole("region", { name: "Gráficos" });
    await expect.poll(() => charts.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(1);
  }
  await page.screenshot({ path: testInfo.outputPath("admin-dashboard.png"), fullPage: true });
});

test("busca, CSV, detalhes e ação real de produto em desktop e celular", async ({ page }) => {
  const mutations = await fixture(page);
  await page.goto("/admin/produtos");
  const search = page.getByRole("textbox", { name: "Buscar em Lista de produtos" });
  await search.fill("não existe");
  await expect(page.getByText("Nenhum registro encontrado.")).toBeVisible();
  await search.fill("Produto da API");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar página filtrada" }).click();
  expect((await download).suggestedFilename()).toBe("admin-pagina-filtrada.csv");
  await page.getByRole("button", { name: "Ver detalhes", exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Descrição real");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Desativar", exact: true }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ativar", exact: true }).filter({ visible: true })).toBeVisible();
  expect(mutations).toContain("PATCH /admin/products/product-real/deactivate");
});

test("rotas restauradas e módulos atuais continuam navegáveis", async ({ page }) => {
  await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [route, title] of [["entregas", "Entregas"], ["financeiro/integracoes", "Integrações de pagamento"], ["financeiro/repasses", "Repasses"], ["configuracoes", "Configurações"], ["relatorios", "Relatórios"], ["clientes", "Clientes"], ["cupons", "Cupons"], ["financeiro", "Financeiro"], ["vendedores", "Vendedores"]]) {
    await page.goto(`/admin/${route}`);
    await expect(page.getByRole("heading", { name: title, exact: true, level: 1 })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), { message: `overflow: ${route}` }).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("financeiro conta pedido dividido uma vez e bloqueia políticas sem API", async ({ page }) => {
  await fixture(page);
  await page.goto("/admin");
  await expect(page.locator('nav[aria-label="Menu do painel"] a[href="/admin/conteudos"]')).toHaveCount(0);
  await page.route("**/api/v1/admin/orders?**", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(paginated([order, { ...order, id: "segunda-loja", sellerId: "outro-vendedor" }])),
  }));
  await page.route("**/api/v1/admin/finance/policies", route => route.fulfill({
    status: 404, contentType: "application/json", body: JSON.stringify({ message: "Not found" }),
  }));
  await page.goto("/admin/financeiro");
  await expect(page.getByText("1 pedido(s)", { exact: true })).toBeVisible();
  await expect(page.getByText("2 pedido(s)", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Políticas financeiras indisponíveis" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprovar nova versão" })).toBeDisabled();
});

test("política financeira sem confirmação não exibe sucesso", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/v1/admin/finance/policies", route => route.request().method() === "POST"
    ? route.fulfill({ status: 204 })
    : route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.goto("/admin/financeiro");
  await expect(page.getByRole("button", { name: "Aprovar nova versão" })).toBeEnabled();
  await page.getByLabel("Comissão (bps; 100 = 1%)").fill("100");
  await page.getByLabel("Taxa do gateway (bps)").fill("0");
  await page.getByLabel("Taxa fixa (centavos por linha)").fill("0");
  await page.getByRole("button", { name: "Aprovar nova versão" }).click();
  await expect(page.getByRole("status").filter({ hasText: "O servidor não confirmou" })).toBeVisible();
  await expect(page.getByText("Nova versão aprovada para próximos pedidos.")).toHaveCount(0);
});

test("falha parcial não vira venda fictícia e detalhe usa registro real", async ({ page }) => {
  await fixture(page, true);
  await page.goto("/admin");
  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível carregar pedidos" })).toBeVisible();
  await expect(page.getByText("Loja da API", { exact: true })).toBeVisible();
  await page.goto("/admin/produtos/product-real");
  await expect(page.getByRole("heading", { name: "Produto da API", exact: true })).toBeVisible();
  await expect(page.getByText("Descrição real", { exact: true })).toBeVisible();
  await page.goto("/admin/produtos/produto-inexistente");
  await expect(page.getByText("Registro não encontrado.")).toBeVisible();
});

test("detalhe encontra registro em outra página sem recorrer ao banco demo", async ({ page }) => {
  await fixture(page);
  const cursors: string[] = [];
  await page.route("**/api/v1/admin/products?**", route => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor");
    if (cursor) cursors.push(cursor);
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(cursor === "cursor-opaco" ? paginated([product]) : { items: [{ ...product, id: "outro", title: "Outro produto" }], pageInfo: { hasNextPage: true, nextCursor: "cursor-opaco" } }) });
  });
  await page.goto("/admin/produtos/product-real");
  await expect(page.getByRole("heading", { name: "Produto da API", exact: true })).toBeVisible();
  expect(cursors).toContain("cursor-opaco");
});

test("cursos redirecionam sem consultar conteúdos", async ({ page }) => {
  await fixture(page);
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  for (const path of ["/admin/conteudos", "/admin/conteudos/content-real"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin$/);
  }
  expect(requests.some(url => url.includes("/api/v1/admin/contents"))).toBe(false);
});

test("APIs ausentes não aparecem como listas vazias", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/v1/notifications", route => route.fulfill({ status: 404, json: { message: "Not Found" } }));
  await page.goto("/admin/notificacoes");
  await expect(page.locator('p[role="alert"]')).toContainText("serviço de notificações ainda não está disponível");
  await expect(page.getByText("Nenhuma notificação.")).toHaveCount(0);
  await page.route("**/api/v1/admin/reports", route => route.fulfill({ status: 404, json: { message: "Not Found" } }));
  await page.goto("/admin/relatorios");
  await expect(page.locator('p[role="alert"]')).toContainText("API de relatórios ainda não está disponível");
  await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
});
