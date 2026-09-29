import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN_STORAGE_KEY,
  ADMIN_STORAGE_KEY_V1,
  createAdminSeed,
} from "../../src/features/admin/data/seed";
import { migrateAdminDemoDb } from "../../src/features/admin/data/migrateAdminDemoDb";
import { hasCredentials, loginAs } from "./helpers/session";

/**
 * O bloco antigo "checkout autenticação e histórico" (retry/reconciliação
 * de "pending checkout operation") testava um mecanismo 100% client-side
 * que não existe mais no app — `parsePendingCheckoutOperation` (src/data/
 * cart.ts) não tem nenhum consumidor fora da própria definição, e o fluxo
 * de checkout real (ver page.tsx) não grava mais pendência nenhuma: ele
 * chama POST /orders/checkout direto e só navega pra /checkout/sucesso em
 * caso de sucesso (sem retry/reconciliação client-side — gap conhecido,
 * documentado no status do projeto). Esse bloco foi removido e substituído
 * pelo describe abaixo, que cobre o checkout real contra o orders-service.
 *
 * A migração V1 → V2 do banco administrativo (`migrateAdminDemoDb`)
 * continua 100% viva — só a sessão usada pra abrir /admin nos testes que
 * navegam foi trocada de injeção direta no localStorage pra login real
 * (ver tests/e2e/helpers/session.ts).
 */

function uniqueSuffix() {
  return Date.now().toString(36);
}

test.describe("checkout real (sessão de cliente)", () => {
  test.beforeEach(() => {
    test.skip(
      !hasCredentials("customer"),
      "requer E2E_CUSTOMER_EMAIL/E2E_CUSTOMER_PASSWORD",
    );
  });

  test("compra japamala, finaliza checkout e aparece no histórico de pedidos", async ({
    page,
    context,
  }) => {
    await loginAs(context, "customer");
    const suffix = uniqueSuffix();

    await page.goto("/produto/japamala");
    await page.getByRole("button", { name: "Comprar agora" }).click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15_000 });

    await page.getByLabel("Nome completo").fill(`Cliente E2E ${suffix}`);
    await page
      .getByLabel("E-mail", { exact: true })
      .fill(`cliente-e2e-${suffix}@example.com`);
    await page.getByLabel("Telefone").fill("11999999999");
    await page.getByLabel("CEP").fill("01310100");
    await page.getByLabel("Rua").fill("Avenida Paulista");
    await page.getByLabel("Número").fill("1000");
    await page.getByLabel("Bairro").fill("Bela Vista");
    await page.getByLabel("Cidade").fill("São Paulo");
    await page.getByLabel("Estado (UF)").fill("SP");

    await page.getByRole("button", { name: "Finalizar pedido" }).click();

    await expect(page).toHaveURL(/\/checkout\/sucesso/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: "Pedido realizado com sucesso" }),
    ).toBeVisible();

    const orderCodeText = await page
      .getByText(/Código do pedido:/)
      .textContent();
    const orderCode = orderCodeText
      ?.replace(/.*Código do pedido:\s*/, "")
      .trim();
    expect(orderCode).toBeTruthy();

    await page.goto("/minha-conta/pedidos");
    await expect(
      page.getByRole("heading", { level: 1, name: "Meus pedidos" }),
    ).toBeVisible({ timeout: 15_000 });

    if (orderCode) {
      await expect(page.getByRole("link", { name: orderCode })).toBeVisible({
        timeout: 15_000,
      });
    }
  });
});

/**
 * A busca administrativa global e a migração V1 → V2 do banco
 * administrativo (`AdminDataContext`/`createAdminSeed()`) continuam sobre
 * o esquema mock em localStorage — não foram migradas pra dado real (ver
 * status-migracao-microservicos.md). Os testes abaixo usam esse seed como
 * fonte de dados legítima, mesmo com a sessão que dá acesso a /admin já
 * sendo real (login via `loginAs`, não mais injeção direta de sessão demo
 * no localStorage).
 */
function buildCustomV1Db() {
  const seed = createAdminSeed();
  const legacyProduct = {
    ...seed.products[0],
    id: "prd-custom-e2e",
    title: "Produto Customizado E2E",
    slug: undefined,
    imageSrc: "/images/potala/product-poder-do-agora-final.png",
    imageAlt: undefined,
    gallery: undefined,
  };
  return {
    ...seed,
    version: 1 as const,
    products: [legacyProduct, ...seed.products.slice(1)],
  };
}

async function trackUnhandledPageErrors(page: Page) {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  await page.addInitScript(() => {
    window.addEventListener("unhandledrejection", (event) => {
      const bag = ((window as unknown as { __potala_unhandled?: string[] })
        .__potala_unhandled ??= []);
      bag.push(String(event.reason));
    });
  });
  return {
    pageErrors,
    async unhandledRejections() {
      return page.evaluate(
        () =>
          (window as unknown as { __potala_unhandled?: string[] })
            .__potala_unhandled ?? [],
      );
    },
  };
}

/**
 * Sem `test.beforeEach` de skip aqui: diferente dos outros specs, este
 * describe mistura os 6 testes abaixo que abrem /admin (precisam de sessão
 * real, via `loginAs`) com ~10 testes puros de `migrateAdminDemoDb()` que
 * não tocam página nenhuma — gatear o describe inteiro pularia esses
 * também sempre que as credenciais não estivessem no ambiente. Cada teste
 * que precisa de sessão real pula individualmente.
 */
test.describe("migração admin V1 → V2", () => {
  test("migra V1, preserva customização e corrige assets", async ({
    page,
    context,
  }) => {
    test.skip(
      !hasCredentials("admin"),
      "requer E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD",
    );
    const v1Db = buildCustomV1Db();
    const errors = await trackUnhandledPageErrors(page);

    await page.addInitScript(
      ({ v1Key, v1Value, v2Key }) => {
        const boot = "__potala_e2e_boot";
        if (window.localStorage.getItem(boot) !== "1") {
          window.localStorage.clear();
          window.sessionStorage.clear();
          window.localStorage.setItem(boot, "1");
        }
        window.localStorage.setItem(v1Key, v1Value);
        window.localStorage.removeItem(v2Key);
      },
      {
        v1Key: ADMIN_STORAGE_KEY_V1,
        v1Value: JSON.stringify(v1Db),
        v2Key: ADMIN_STORAGE_KEY,
      },
    );

    await loginAs(context, "admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Painel/i })).toBeVisible({
      timeout: 15_000,
    });

    const migrated = await page.evaluate(
      ({ v1Key, v2Key, productId }) => {
        const v2Raw = window.localStorage.getItem(v2Key);
        const v1Raw = window.localStorage.getItem(v1Key);
        if (!v2Raw) {
          return { ok: false as const, reason: "missing-v2" };
        }
        const db = JSON.parse(v2Raw) as {
          version: number;
          products: Array<{
            id: string;
            title: string;
            slug?: string;
            imageSrc: string;
            imageAlt?: string;
          }>;
        };
        const product = db.products.find((item) => item.id === productId);
        return {
          ok: true as const,
          version: db.version,
          v1Gone: v1Raw === null,
          product,
        };
      },
      {
        v1Key: ADMIN_STORAGE_KEY_V1,
        v2Key: ADMIN_STORAGE_KEY,
        productId: "prd-custom-e2e",
      },
    );

    expect(migrated.ok).toBeTruthy();
    if (!migrated.ok) return;

    expect(migrated.version).toBe(2);
    expect(migrated.v1Gone).toBeTruthy();
    expect(migrated.product?.title).toBe("Produto Customizado E2E");
    expect(migrated.product?.slug).toBeTruthy();
    expect(migrated.product?.imageSrc).toBe(
      "/images/potala/product-livro-agora-final.png",
    );
    expect(migrated.product?.imageAlt).toBeTruthy();
    expect(errors.pageErrors).toEqual([]);
    expect(await errors.unhandledRejections()).toEqual([]);
  });

  test("A: falha ao gravar V2 mantém V1 e dados carregados", async ({
    page,
    context,
  }) => {
    test.skip(
      !hasCredentials("admin"),
      "requer E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD",
    );
    const v1Db = buildCustomV1Db();
    const v1Value = JSON.stringify(v1Db);
    const errors = await trackUnhandledPageErrors(page);

    await page.addInitScript(
      ({ v1Key, v1Value, v2Key }) => {
        const boot = "__potala_e2e_boot";
        if (window.localStorage.getItem(boot) !== "1") {
          window.localStorage.clear();
          window.sessionStorage.clear();
          window.localStorage.setItem(boot, "1");
        }
        window.localStorage.setItem(v1Key, v1Value);
        window.localStorage.removeItem(v2Key);

        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === v2Key) {
            throw new Error("e2e-simulated-setItem-v2");
          }
          return originalSetItem.call(this, key, value);
        };
      },
      {
        v1Key: ADMIN_STORAGE_KEY_V1,
        v1Value,
        v2Key: ADMIN_STORAGE_KEY,
      },
    );

    await loginAs(context, "admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Painel/i })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/admin/produtos");
    await expect(
      page.getByText("Produto Customizado E2E").first(),
    ).toBeAttached({ timeout: 15_000 });

    const storage = await page.evaluate(
      ({ v1Key, v2Key, expectedV1 }) => ({
        v1Raw: window.localStorage.getItem(v1Key),
        v2Raw: window.localStorage.getItem(v2Key),
        v1Intact: window.localStorage.getItem(v1Key) === expectedV1,
      }),
      {
        v1Key: ADMIN_STORAGE_KEY_V1,
        v2Key: ADMIN_STORAGE_KEY,
        expectedV1: v1Value,
      },
    );

    expect(storage.v2Raw).toBeNull();
    expect(storage.v1Intact).toBeTruthy();
    expect(errors.pageErrors).toEqual([]);
    expect(await errors.unhandledRejections()).toEqual([]);
  });

  test("B: falha ao remover V1 após gravar V2", async ({ page, context }) => {
    test.skip(
      !hasCredentials("admin"),
      "requer E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD",
    );
    const v1Db = buildCustomV1Db();
    const v1Value = JSON.stringify(v1Db);
    const errors = await trackUnhandledPageErrors(page);

    await page.addInitScript(
      ({ v1Key, v1Value, v2Key }) => {
        const boot = "__potala_e2e_boot";
        if (window.localStorage.getItem(boot) !== "1") {
          window.localStorage.clear();
          window.sessionStorage.clear();
          window.localStorage.setItem(boot, "1");
        }
        window.localStorage.setItem(v1Key, v1Value);
        window.localStorage.removeItem(v2Key);

        const originalRemoveItem = Storage.prototype.removeItem;
        Storage.prototype.removeItem = function (key) {
          if (key === v1Key) {
            throw new Error("e2e-simulated-removeItem-v1");
          }
          return originalRemoveItem.call(this, key);
        };
      },
      {
        v1Key: ADMIN_STORAGE_KEY_V1,
        v1Value,
        v2Key: ADMIN_STORAGE_KEY,
      },
    );

    await loginAs(context, "admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Painel/i })).toBeVisible({
      timeout: 15_000,
    });

    const storage = await page.evaluate(
      ({ v1Key, v2Key, productId, expectedV1 }) => {
        const v2Raw = window.localStorage.getItem(v2Key);
        const v1Raw = window.localStorage.getItem(v1Key);
        if (!v2Raw) {
          return { ok: false as const, reason: "missing-v2" };
        }
        const db = JSON.parse(v2Raw) as {
          version: number;
          products: Array<{ id: string; title: string }>;
        };
        return {
          ok: true as const,
          version: db.version,
          v1Preserved: v1Raw === expectedV1,
          productTitle: db.products.find((item) => item.id === productId)?.title,
        };
      },
      {
        v1Key: ADMIN_STORAGE_KEY_V1,
        v2Key: ADMIN_STORAGE_KEY,
        productId: "prd-custom-e2e",
        expectedV1: v1Value,
      },
    );

    expect(storage.ok).toBeTruthy();
    if (!storage.ok) return;
    expect(storage.version).toBe(2);
    expect(storage.v1Preserved).toBeTruthy();
    expect(storage.productTitle).toBe("Produto Customizado E2E");
    expect(errors.pageErrors).toEqual([]);
    expect(await errors.unhandledRejections()).toEqual([]);
  });

  test("C: erro ao migrar V2 recupera V1 válida", async ({
    page,
    context,
  }) => {
    test.skip(
      !hasCredentials("admin"),
      "requer E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD",
    );
    const v1Db = buildCustomV1Db();
    const v1Value = JSON.stringify(v1Db);
    const seed = createAdminSeed();
    const badV2 = {
      ...seed,
      version: 2,
      sellers: [null],
    };
    const badV2Value = JSON.stringify(badV2);

    expect(migrateAdminDemoDb(JSON.parse(badV2Value))).toBeNull();

    const errors = await trackUnhandledPageErrors(page);

    await page.addInitScript(
      ({ v1Key, v1Value, v2Key, v2Value }) => {
        const boot = "__potala_e2e_boot";
        if (window.localStorage.getItem(boot) !== "1") {
          window.localStorage.clear();
          window.sessionStorage.clear();
          window.localStorage.setItem(boot, "1");
        }
        window.localStorage.setItem(v1Key, v1Value);
        window.localStorage.setItem(v2Key, v2Value);
      },
      {
        v1Key: ADMIN_STORAGE_KEY_V1,
        v1Value,
        v2Key: ADMIN_STORAGE_KEY,
        v2Value: badV2Value,
      },
    );

    await loginAs(context, "admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Painel/i })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/admin/produtos");
    await expect(
      page.getByText("Produto Customizado E2E").first(),
    ).toBeAttached({ timeout: 15_000 });

    const storage = await page.evaluate(
      ({ v1Key, v2Key, productId }) => {
        const v2Raw = window.localStorage.getItem(v2Key);
        const v1Raw = window.localStorage.getItem(v1Key);
        const db = v2Raw
          ? (JSON.parse(v2Raw) as {
              version: number;
              sellers: Array<{ id: string }>;
              products: Array<{ id: string; title: string }>;
            })
          : null;
        return {
          v1Gone: v1Raw === null,
          version: db?.version ?? null,
          productTitle: db?.products.find((item) => item.id === productId)
            ?.title,
          sellerCount: db?.sellers.length ?? 0,
        };
      },
      {
        v1Key: ADMIN_STORAGE_KEY_V1,
        v2Key: ADMIN_STORAGE_KEY,
        productId: "prd-custom-e2e",
      },
    );

    // V1 foi a fonte: após gravação V2 bem-sucedida, V1 deve ser removida.
    expect(storage.v1Gone).toBeTruthy();
    expect(storage.version).toBe(2);
    expect(storage.productTitle).toBe("Produto Customizado E2E");
    expect(storage.sellerCount).toBe(createAdminSeed().sellers.length);
    expect(errors.pageErrors).toEqual([]);
    expect(await errors.unhandledRejections()).toEqual([]);
  });

  test("E: coleção com null/string invalida o banco; legado só sem campos novos migra", async ({
    page,
    context,
  }) => {
    test.skip(
      !hasCredentials("admin"),
      "requer E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD",
    );
    const seed = createAdminSeed();
    const corrupted = {
      ...seed,
      version: 2 as const,
      products: [null, "invalid", ...seed.products],
    };
    expect(migrateAdminDemoDb(corrupted)).toBeNull();

    const seedProduct = seed.products[0];
    expect(seedProduct).toBeTruthy();
    const legacyProduct = {
      ...seedProduct,
      title: "Produto Legado Campos Novos",
      slug: undefined,
      imageAlt: undefined,
      gallery: undefined,
      description: undefined,
      imageSrc: "/images/potala/product-quartzo-final.png",
      attributes: undefined,
    };
    const legacyDb = {
      ...seed,
      version: 1 as const,
      products: [legacyProduct, ...seed.products.slice(1)],
    };
    const legacyMigrated = migrateAdminDemoDb(legacyDb);
    expect(legacyMigrated).not.toBeNull();
    const legacyItem = legacyMigrated?.products.find(
      (item) => item.id === seedProduct?.id,
    );
    expect(legacyItem?.title).toBe("Produto Legado Campos Novos");
    expect(legacyItem?.slug).toBeTruthy();
    expect(legacyItem?.imageAlt).toBeTruthy();
    expect(legacyItem?.imageSrc).toBe("/images/potala/product-quartzo.jpg");
    expect(legacyItem?.description).toBe(seedProduct?.description);
    expect(legacyItem?.attributes).toEqual(seedProduct?.attributes ?? {});

    const corruptedValue = JSON.stringify(corrupted);
    const errors = await trackUnhandledPageErrors(page);

    await page.addInitScript(
      ({ v1Key, v2Key, v2Value }) => {
        const boot = "__potala_e2e_boot";
        if (window.localStorage.getItem(boot) !== "1") {
          window.localStorage.clear();
          window.sessionStorage.clear();
          window.localStorage.setItem(boot, "1");
        }
        window.localStorage.removeItem(v1Key);
        window.localStorage.setItem(v2Key, v2Value);
      },
      {
        v1Key: ADMIN_STORAGE_KEY_V1,
        v2Key: ADMIN_STORAGE_KEY,
        v2Value: corruptedValue,
      },
    );

    await loginAs(context, "admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Painel/i })).toBeVisible({
      timeout: 15_000,
    });

    const storage = await page.evaluate(
      ({ v2Key, expectedV2 }) => ({
        v2Intact: window.localStorage.getItem(v2Key) === expectedV2,
      }),
      { v2Key: ADMIN_STORAGE_KEY, expectedV2: corruptedValue },
    );

    expect(storage.v2Intact).toBeTruthy();
    expect(errors.pageErrors).toEqual([]);
    expect(await errors.unhandledRejections()).toEqual([]);
  });

  test("coleções vazias válidas, sem mutação e idempotência", async () => {
    const seed = createAdminSeed();
    const emptyCollectionsDb = {
      ...seed,
      version: 2 as const,
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
    };
    const emptyMigrated = migrateAdminDemoDb(emptyCollectionsDb);
    expect(emptyMigrated).not.toBeNull();
    expect(emptyMigrated?.sellers).toEqual([]);
    expect(emptyMigrated?.products).toEqual([]);
    expect(emptyMigrated?.orders).toEqual([]);
    expect(emptyMigrated?.shipments).toEqual([]);
    expect(emptyMigrated?.transactions).toEqual([]);
    expect(emptyMigrated?.payouts).toEqual([]);
    expect(emptyMigrated?.customers).toEqual([]);
    expect(emptyMigrated?.contents).toEqual([]);
    expect(emptyMigrated?.coupons).toEqual([]);
    expect(emptyMigrated?.categories).toEqual([]);
    expect(emptyMigrated?.attributes).toEqual([]);
    expect(emptyMigrated?.gateways).toEqual([]);
    expect(emptyMigrated?.notifications).toEqual([]);

    const custom = buildCustomV1Db();
    const snapshot = JSON.parse(JSON.stringify(custom)) as unknown;
    const first = migrateAdminDemoDb(custom);
    expect(custom).toEqual(snapshot);
    expect(first).not.toBeNull();
    expect(first?.products.some((item) => item.id === "prd-custom-e2e")).toBe(
      true,
    );

    const second = migrateAdminDemoDb(first);
    expect(second).toEqual(first);
  });

  test("sem fallback de preço/estoque/comissão nem reposição de coleções pelo seed", async () => {
    const seed = createAdminSeed();
    const seedProduct = seed.products[0];
    const seedSeller = seed.sellers[0];
    expect(seedProduct).toBeTruthy();
    expect(seedSeller).toBeTruthy();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        products: [{ ...seedProduct, priceCents: "1990" }],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        products: [{ ...seedProduct, priceCents: undefined }],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        products: [{ ...seedProduct, stock: null }],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        sellers: [{ ...seedSeller, commissionPercent: "12" }],
      }),
    ).toBeNull();

    const customPrice = (seedProduct?.priceCents ?? 0) + 777;
    const customStock = (seedProduct?.stock ?? 0) + 11;
    const customCommission = (seedSeller?.commissionPercent ?? 0) + 3;
    const preserved = migrateAdminDemoDb({
      ...seed,
      version: 2,
      products: [
        { ...seedProduct, priceCents: customPrice, stock: customStock },
        ...seed.products.slice(1),
      ],
      sellers: [
        { ...seedSeller, commissionPercent: customCommission },
        ...seed.sellers.slice(1),
      ],
    });
    expect(preserved).not.toBeNull();
    const preservedProduct = preserved?.products.find(
      (item) => item.id === seedProduct?.id,
    );
    const preservedSeller = preserved?.sellers.find(
      (item) => item.id === seedSeller?.id,
    );
    expect(preservedProduct?.priceCents).toBe(customPrice);
    expect(preservedProduct?.stock).toBe(customStock);
    expect(preservedSeller?.commissionPercent).toBe(customCommission);
    expect(preservedProduct?.priceCents).not.toBe(seedProduct?.priceCents);
    expect(preservedSeller?.commissionPercent).not.toBe(
      seedSeller?.commissionPercent,
    );

    const { transactions: _t, ...v2WithoutTransactions } = seed;
    expect(
      migrateAdminDemoDb({ ...v2WithoutTransactions, version: 2 }),
    ).toBeNull();

    const { payouts: _p, shipments: _s, ...v2WithoutFinance } = seed;
    expect(
      migrateAdminDemoDb({ ...v2WithoutFinance, version: 2 }),
    ).toBeNull();

    const v1CoreOnly = {
      version: 1 as const,
      sellers: seed.sellers,
      products: seed.products,
      orders: seed.orders,
      customers: seed.customers,
    };
    expect(migrateAdminDemoDb(v1CoreOnly)).toBeNull();
  });

  test("estrutura raiz V1/V2: coleções, settings, updatedAt e version", async () => {
    const seed = createAdminSeed();
    const requiredCollections = [
      "sellers",
      "products",
      "orders",
      "shipments",
      "transactions",
      "payouts",
      "customers",
      "contents",
      "coupons",
      "categories",
      "attributes",
      "gateways",
      "notifications",
    ] as const;

    const v1Complete = { ...seed, version: 1 as const };
    const fromV1 = migrateAdminDemoDb(v1Complete);
    expect(fromV1).not.toBeNull();
    expect(fromV1?.version).toBe(2);
    expect(fromV1?.updatedAt).toBe(seed.updatedAt);
    expect(fromV1?.products.map((item) => item.id)).toEqual(
      seed.products.map((item) => item.id),
    );

    const v2Complete = migrateAdminDemoDb({ ...seed, version: 2 as const });
    expect(v2Complete).not.toBeNull();
    expect(v2Complete?.version).toBe(2);

    for (const version of [1, 2] as const) {
      for (const key of requiredCollections) {
        const { [key]: _removed, ...rest } = { ...seed, version };
        expect(migrateAdminDemoDb(rest)).toBeNull();
      }
    }

    const allEmpty = {
      ...seed,
      version: 2 as const,
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
    };
    const emptyOk = migrateAdminDemoDb(allEmpty);
    expect(emptyOk).not.toBeNull();
    for (const key of requiredCollections) {
      expect(emptyOk?.[key]).toEqual([]);
    }

    expect(
      migrateAdminDemoDb({ ...seed, version: 2, settings: undefined }),
    ).toBeNull();
    expect(
      migrateAdminDemoDb({ ...seed, version: 2, settings: null }),
    ).toBeNull();
    expect(
      migrateAdminDemoDb({ ...seed, version: 2, settings: [] }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({ ...seed, version: 2, updatedAt: undefined }),
    ).toBeNull();
    expect(
      migrateAdminDemoDb({ ...seed, version: 2, updatedAt: 123 }),
    ).toBeNull();

    const { version: _v, ...withoutVersion } = seed;
    expect(migrateAdminDemoDb(withoutVersion)).toBeNull();
    expect(migrateAdminDemoDb({ ...seed, version: 3 })).toBeNull();
    expect(migrateAdminDemoDb({ ...seed, version: "2" })).toBeNull();
  });

  test("validação interna de orders e customers", async () => {
    const seed = createAdminSeed();
    const validOrder = seed.orders[0];
    const validCustomer = seed.customers[0];
    expect(validOrder).toBeTruthy();
    expect(validCustomer).toBeTruthy();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        orders: [{ id: "pedido-incompleto" }],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        customers: [{ id: "cliente-incompleto" }],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        orders: [{ ...validOrder, code: 123 }],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        orders: [{ ...validOrder, totalCents: undefined }],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        orders: [{ ...validOrder, status: "desconhecido" }],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        orders: [{ ...validOrder, paymentMethod: "paypal" }],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        orders: [{ ...validOrder, items: [null] }],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        orders: [
          {
            ...validOrder,
            items: [{ productId: "prd-1", title: "X" }],
          },
        ],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        orders: [
          {
            ...validOrder,
            items: [
              {
                productId: "prd-1",
                title: "X",
                quantity: "2",
                unitPriceCents: 100,
              },
            ],
          },
        ],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        customers: [{ ...validCustomer, tags: ["ok", 1] }],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        customers: [{ ...validCustomer, preferredProducts: [null] }],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        orders: [
          {
            ...validOrder,
            timeline: [{ id: "ev-x", at: "2026-01-01T00:00:00.000Z" }],
          },
        ],
      }),
    ).toBeNull();

    expect(
      migrateAdminDemoDb({
        ...seed,
        version: 2,
        customers: [
          {
            ...validCustomer,
            timeline: [null],
          },
        ],
      }),
    ).toBeNull();

    const customNotes = "nota personalizada e2e";
    const customTag = "vip-e2e";
    const preserved = migrateAdminDemoDb({
      ...seed,
      version: 2,
      orders: [
        {
          ...validOrder,
          notes: customNotes,
          items: [],
          timeline: [],
        },
        ...seed.orders.slice(1),
      ],
      customers: [
        {
          ...validCustomer,
          tags: [customTag],
          preferredProducts: [],
          notes: "",
          timeline: [
            {
              id: "ev-custom",
              at: "2026-01-02T00:00:00.000Z",
              label: "Atualizado",
            },
          ],
        },
        ...seed.customers.slice(1),
      ],
    });
    expect(preserved).not.toBeNull();
    expect(preserved?.orders[0]?.notes).toBe(customNotes);
    expect(preserved?.orders[0]?.items).toEqual([]);
    expect(preserved?.orders[0]?.timeline).toEqual([]);
    expect(preserved?.customers[0]?.tags).toEqual([customTag]);
    expect(preserved?.customers[0]?.preferredProducts).toEqual([]);
    expect(preserved?.customers[0]?.notes).toBe("");
    expect(preserved?.customers[0]?.timeline).toEqual([
      {
        id: "ev-custom",
        at: "2026-01-02T00:00:00.000Z",
        label: "Atualizado",
      },
    ]);

    const input = {
      ...seed,
      version: 2 as const,
      customers: [
        {
          ...validCustomer,
          tags: ["a"],
          preferredProducts: ["b"],
        },
        ...seed.customers.slice(1),
      ],
    };
    const snapshot = JSON.parse(JSON.stringify(input)) as unknown;
    const first = migrateAdminDemoDb(input);
    expect(input).toEqual(snapshot);
    expect(first).not.toBeNull();
    const second = migrateAdminDemoDb(first);
    expect(second).toEqual(first);
  });

  test("D: nenhuma versão aproveitável usa seed em memória", async ({
    page,
    context,
  }) => {
    test.skip(
      !hasCredentials("admin"),
      "requer E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD",
    );
    const invalidV2 = JSON.stringify({ version: 2, broken: true });
    const invalidV1 = JSON.stringify({ version: 1, broken: true });
    const seedProductId = createAdminSeed().products[0]?.id;
    const errors = await trackUnhandledPageErrors(page);

    await page.addInitScript(
      ({ v1Key, v1Value, v2Key, v2Value }) => {
        const boot = "__potala_e2e_boot";
        if (window.localStorage.getItem(boot) !== "1") {
          window.localStorage.clear();
          window.sessionStorage.clear();
          window.localStorage.setItem(boot, "1");
        }
        window.localStorage.setItem(v1Key, v1Value);
        window.localStorage.setItem(v2Key, v2Value);
      },
      {
        v1Key: ADMIN_STORAGE_KEY_V1,
        v1Value: invalidV1,
        v2Key: ADMIN_STORAGE_KEY,
        v2Value: invalidV2,
      },
    );

    await loginAs(context, "admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Painel/i })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/admin/produtos");
    await expect(page.getByRole("heading", { name: /Produtos/i })).toBeVisible({
      timeout: 15_000,
    });
    if (seedProductId) {
      await expect(
        page.locator(`a[href="/admin/produtos/${seedProductId}"]`).first(),
      ).toBeAttached({ timeout: 15_000 });
    }

    const storage = await page.evaluate(
      ({ v1Key, v2Key, expectedV1, expectedV2 }) => ({
        v1Raw: window.localStorage.getItem(v1Key),
        v2Raw: window.localStorage.getItem(v2Key),
        v1Intact: window.localStorage.getItem(v1Key) === expectedV1,
        v2Intact: window.localStorage.getItem(v2Key) === expectedV2,
      }),
      {
        v1Key: ADMIN_STORAGE_KEY_V1,
        v2Key: ADMIN_STORAGE_KEY,
        expectedV1: invalidV1,
        expectedV2: invalidV2,
      },
    );

    expect(storage.v1Intact).toBeTruthy();
    expect(storage.v2Intact).toBeTruthy();
    expect(errors.pageErrors).toEqual([]);
    expect(await errors.unhandledRejections()).toEqual([]);
  });
});
