// F2.1 -- política da chave de idempotência do checkout.
// Sem dependências: node:test + execução direta do .ts (Node >= 22.18):
//   node --test tests/unit/checkoutIdempotency.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  CHECKOUT_ATTEMPT_STORAGE_KEY,
  CHECKOUT_ATTEMPT_TTL_MS,
  checkoutFingerprint,
  checkoutSignature,
  clearCheckoutAttempt,
  createIdempotencyKey,
  loadCheckoutAttempt,
  nextCheckoutAttempt,
  resumeCheckoutAttempt,
  shouldKeepCheckoutAttemptAfterError,
} from "../../src/lib/api/checkoutIdempotency.ts";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const input = {
  items: [{ productId: "p1", variantId: "v1", quantity: 1 }],
  shippingAddress: { recipient: "Maria", street: "Rua A", number: "1" },
};

function counterKeys() {
  let n = 0;
  return () => `chave-${++n}`;
}

test("gera UUID v4 aceito pelo servidor (16-128 caracteres de [A-Za-z0-9._:-])", () => {
  const key = createIdempotencyKey();
  assert.match(key, UUID_V4);
  assert.match(key, /^[A-Za-z0-9._:-]{16,128}$/);
  assert.notEqual(createIdempotencyKey(), key);
});

test("primeira tentativa abre uma chave nova", () => {
  const attempt = nextCheckoutAttempt(null, checkoutSignature(input), counterKeys());
  assert.deepEqual(attempt, { key: "chave-1", signature: checkoutSignature(input) });
});

test("retry com o MESMO payload reaproveita a MESMA chave (não cria segundo pedido)", () => {
  const keys = counterKeys();
  const first = nextCheckoutAttempt(null, checkoutSignature(input), keys);
  const retry = nextCheckoutAttempt(first, checkoutSignature({ ...input }), keys);
  assert.equal(retry, first);
  assert.equal(retry.key, "chave-1");
});

test("payload alterado (carrinho/endereço/cupom) abre nova chave -- evita 422", () => {
  const keys = counterKeys();
  const first = nextCheckoutAttempt(null, checkoutSignature(input), keys);
  const changed = nextCheckoutAttempt(first, checkoutSignature({ ...input, couponCode: "PROMO10" }), keys);
  assert.equal(changed.key, "chave-2");
});

test("depois de concluída (ref limpa), a próxima compra usa nova chave", () => {
  const keys = counterKeys();
  nextCheckoutAttempt(null, checkoutSignature(input), keys);
  const nextPurchase = nextCheckoutAttempt(null, checkoutSignature(input), keys);
  assert.equal(nextPurchase.key, "chave-2");
});

test("sem gerador seguro: segue sem chave (comportamento anterior), sem lançar", () => {
  assert.equal(nextCheckoutAttempt(null, "x", () => null), null);
});

test("mantém a chave quando o resultado é incerto ou transitório", () => {
  for (const status of [0, 409, 500, 502, 503, 504]) {
    assert.equal(shouldKeepCheckoutAttemptAfterError(status), true, `status ${status}`);
  }
});

test("descarta a chave quando o servidor recusou sem criar pedido", () => {
  for (const status of [400, 401, 403, 422]) {
    assert.equal(shouldKeepCheckoutAttemptAfterError(status), false, `status ${status}`);
  }
});

// ---------------------------------------------------------------------------
// P-3 -- tentativa persistida na sessionStorage da aba
// ---------------------------------------------------------------------------

/** Chaves no formato aceito pelo servidor (16-128 caracteres). */
const K = (n) => `chave-tentativa-${String(n).padStart(4, "0")}`;
function storageKeys() {
  let n = 0;
  return () => K(++n);
}

/** sessionStorage em memória: um objeto por "aba"; o refresh mantém o mesmo. */
function memoryStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

/** Simula o handleSubmit do checkout: ref (memória) + storage da aba. */
function submit(tab, { memory = null, userId = "user-1", payload = input, now = 1_000, keys }) {
  return resumeCheckoutAttempt({
    memory,
    storage: tab,
    fingerprint: checkoutFingerprint(userId, payload),
    now,
    newKey: keys,
  });
}

test("P-3 refresh: resultado incerto + recarregar a aba => MESMA chave", () => {
  const tab = memoryStorage();
  const keys = storageKeys();
  const first = submit(tab, { keys });
  // refresh: o componente remonta, a ref volta a null; a sessionStorage fica.
  const afterRefresh = submit(tab, { memory: null, now: 5_000, keys });
  assert.equal(first.key, K(1));
  assert.equal(afterRefresh.key, K(1));
});

test("P-3 recuperação: 503 repetido não descarta a chave (mesma chave a cada envio)", () => {
  const tab = memoryStorage();
  const keys = storageKeys();
  let memory = submit(tab, { keys });
  for (let i = 1; i <= 3; i += 1) {
    assert.equal(shouldKeepCheckoutAttemptAfterError(503), true);
    memory = submit(tab, { memory, now: 1_000 + i * 60_000, keys });
    assert.equal(memory.key, K(1), `envio ${i}`);
  }
  // a validade é renovada a cada envio
  assert.equal(memory.expiresAt, 1_000 + 3 * 60_000 + CHECKOUT_ATTEMPT_TTL_MS);
});

test("P-3 troca de usuário na mesma aba => nova chave e a tentativa anterior é descartada", () => {
  const tab = memoryStorage();
  const keys = storageKeys();
  const memory = submit(tab, { userId: "user-1", keys });
  const other = submit(tab, { memory, userId: "user-2", keys });
  assert.equal(other.key, K(2));
  // voltar ao usuário 1 não ressuscita a chave antiga
  assert.equal(submit(tab, { userId: "user-1", keys }).key, K(3));
});

test("P-3 mudança de carrinho, endereço ou cupom => nova chave", () => {
  const variants = [
    { ...input, items: [{ productId: "p1", variantId: "v1", quantity: 2 }] },
    { ...input, shippingAddress: { ...input.shippingAddress, number: "2" } },
    { ...input, couponCode: "PROMO10" },
  ];
  for (const payload of variants) {
    const tab = memoryStorage();
    const keys = storageKeys();
    const memory = submit(tab, { keys });
    assert.equal(submit(tab, { memory, payload, keys }).key, K(2));
    // e um refresh depois disso também não volta para a chave antiga
    assert.equal(submit(tab, { payload, keys }).key, K(2));
  }
});

test("P-3 expiração: tentativa vencida não é retomada e é removida do storage", () => {
  const tab = memoryStorage();
  const keys = storageKeys();
  const memory = submit(tab, { now: 0, keys });
  const late = CHECKOUT_ATTEMPT_TTL_MS + 1;
  assert.equal(loadCheckoutAttempt(tab, checkoutFingerprint("user-1", input), late), null);
  assert.equal(tab.data.has(CHECKOUT_ATTEMPT_STORAGE_KEY), false);
  // nem a cópia em memória (ref) é reaproveitada depois de vencer
  assert.equal(submit(tab, { memory, now: late, keys }).key, K(2));
});

test("P-3 sucesso confirmado: limpa ref e storage => a próxima compra igual usa nova chave", () => {
  const tab = memoryStorage();
  const keys = storageKeys();
  submit(tab, { keys });
  clearCheckoutAttempt(tab); // 2xx do checkout
  assert.equal(tab.data.size, 0);
  assert.equal(submit(tab, { memory: null, keys }).key, K(2));
});

test("P-3 recusa definitiva (400/401/403/422) limpa; nova tentativa usa nova chave", () => {
  const tab = memoryStorage();
  const keys = storageKeys();
  submit(tab, { keys });
  assert.equal(shouldKeepCheckoutAttemptAfterError(422), false);
  clearCheckoutAttempt(tab);
  assert.equal(submit(tab, { keys }).key, K(2));
});

test("P-3 o storage não guarda dados do checkout: só versão, chave, hash e validade", () => {
  const tab = memoryStorage();
  const payload = {
    items: [{ productId: "produto-abc", variantId: "variante-xyz", quantity: 1 }],
    shippingAddress: { recipient: "Maria Souza", street: "Rua das Flores", number: "123" },
    couponCode: "PROMO10",
  };
  submit(tab, { userId: "user-secret-id", payload, keys: storageKeys() });
  const raw = tab.data.get(CHECKOUT_ATTEMPT_STORAGE_KEY);
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ["expiresAt", "fingerprint", "key", "v"]);
  for (const leaked of ["Maria", "Flores", "123", "PROMO10", "produto-abc", "variante-xyz", "user-secret-id"]) {
    assert.equal(raw.includes(leaked), false, leaked);
  }
});

test("P-3 storage indisponível ou corrompido: não lança e a ref mantém a chave na página", () => {
  const throwing = {
    getItem() { throw new Error("SecurityError"); },
    setItem() { throw new Error("QuotaExceededError"); },
    removeItem() { throw new Error("SecurityError"); },
  };
  const keys = storageKeys();
  const memory = submit(throwing, { keys });
  assert.equal(submit(throwing, { memory, keys }).key, K(1));
  assert.equal(submit(null, { memory, keys }).key, K(1));

  const tab = memoryStorage();
  tab.setItem(CHECKOUT_ATTEMPT_STORAGE_KEY, "{not json");
  assert.equal(submit(tab, { keys }).key, K(2));
  tab.setItem(CHECKOUT_ATTEMPT_STORAGE_KEY, JSON.stringify({ v: 1, key: "x", fingerprint: "y", expiresAt: 9e15 }));
  assert.equal(loadCheckoutAttempt(tab, "y", 0), null); // chave fora do formato aceito
});

test("P-3 fingerprint: determinístico, sensível a usuário e payload", () => {
  assert.equal(checkoutFingerprint("u", input), checkoutFingerprint("u", { ...input }));
  assert.notEqual(checkoutFingerprint("u", input), checkoutFingerprint("v", input));
  assert.notEqual(checkoutFingerprint(undefined, input), checkoutFingerprint("u", input));
  assert.notEqual(checkoutFingerprint("u", input), checkoutFingerprint("u", { ...input, couponCode: "X" }));
  assert.match(checkoutFingerprint("u", input), /^fp1-[0-9a-f]{28}$/);
});
