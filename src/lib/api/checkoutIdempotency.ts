/**
 * F2.1 -- chave de idempotência do checkout (header `Idempotency-Key` de
 * POST /orders/checkout no orders-service; ver
 * potala-orders-service/docs/checkout-idempotency.md).
 *
 * Uma chave por TENTATIVA DE COMPRA, não por clique nem por requisição:
 * - mesma compra (mesmo payload) => mesma chave, inclusive depois de falha
 *   de rede, 409 ("em andamento") ou 5xx -- o servidor devolve o pedido já
 *   criado em vez de criar outro;
 * - payload diferente (carrinho, endereço ou cupom mudou) => nova chave;
 * - compra concluída, ou recusada de forma definitiva sem pedido criado
 *   (400/401/403/422) => a próxima tentativa usa nova chave.
 *
 * P-3 -- a tentativa sobrevive a um refresh da MESMA aba (sessionStorage),
 * para que reenviar depois de um resultado incerto (ex.: 503 do gateway no
 * cold start) reaproveite a chave em vez de abrir um segundo pedido. O que
 * fica guardado é só {v, key, fingerprint, expiresAt}: o fingerprint é um
 * hash de usuário + payload, então endereço, itens, cupom e e-mail nunca
 * vão para o storage. Usuário ou payload diferente => tentativa descartada;
 * expira em CHECKOUT_ATTEMPT_TTL_MS sem novo envio.
 *
 * Funções puras (sem React nem imports de "@/..."): testadas com node:test
 * em tests/unit/checkoutIdempotency.test.mjs.
 */

export interface CheckoutAttempt {
  /** Valor enviado em `Idempotency-Key` (UUID v4). */
  readonly key: string;
  /**
   * Identifica a compra desta tentativa: checkoutSignature (payload) ou,
   * no checkout, checkoutFingerprint (usuário + payload).
   */
  readonly signature: string;
  /** Epoch ms após o qual a tentativa não é mais retomada (P-3). */
  readonly expiresAt?: number;
}

/**
 * Representação determinística do payload: o checkout monta o objeto sempre
 * com os mesmos campos na mesma ordem, então JSON.stringify basta para
 * distinguir "mesma compra" de "compra alterada".
 */
export function checkoutSignature(input: unknown): string {
  return JSON.stringify(input);
}

/** UUID v4; null se o navegador não oferecer gerador aleatório seguro. */
export function createIdempotencyKey(): string | null {
  if (typeof crypto === "undefined") {
    return null;
  }
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return null;
}

/**
 * Tentativa a usar no próximo envio: reaproveita a anterior se o payload é
 * o mesmo; senão abre uma nova. Sem gerador seguro, devolve null e o
 * checkout segue sem o header (comportamento anterior do servidor).
 */
export function nextCheckoutAttempt(
  previous: CheckoutAttempt | null,
  signature: string,
  newKey: () => string | null = createIdempotencyKey,
): CheckoutAttempt | null {
  if (previous && previous.signature === signature) {
    return previous;
  }
  const key = newKey();
  return key ? { key, signature } : null;
}

/**
 * Depois de um erro, manter a chave? Sim quando o resultado é incerto ou
 * transitório -- falha de rede (status 0), 409 (tentativa em andamento),
 * 5xx (inclusive o 503 do gateway quando o orders-service demora, caso em
 * que o pedido pode ter sido criado): repetir com a mesma chave nunca gera
 * um segundo pedido. Não quando o servidor recusou sem criar pedido
 * (400 validação, 401/403 sessão, 422 chave usada com outro payload).
 */
export function shouldKeepCheckoutAttemptAfterError(status: number): boolean {
  return ![400, 401, 403, 422].includes(status);
}

// ---------------------------------------------------------------------------
// P-3 -- persistência da tentativa na aba (sessionStorage)
// ---------------------------------------------------------------------------

/** Chave do sessionStorage (por aba; some ao fechar a aba). */
export const CHECKOUT_ATTEMPT_STORAGE_KEY = "potala.checkout.attempt.v1";

/**
 * Validade de uma tentativa sem novo envio (renovada a cada envio). Repetir
 * com a mesma chave é sempre seguro no servidor; o prazo só limita por
 * quanto tempo uma tentativa abandonada ainda é retomada.
 */
export const CHECKOUT_ATTEMPT_TTL_MS = 30 * 60 * 1000;

/** Subconjunto de Storage usado aqui (facilita testar sem navegador). */
export interface CheckoutAttemptStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY_FORMAT = /^[A-Za-z0-9._:-]{16,128}$/;

/** Hash síncrono não criptográfico (cyrb53): só compara, não protege. */
function cyrb53(text: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/**
 * Identidade da compra = usuário + payload (carrinho, endereço, cupom...),
 * reduzida a um hash para não guardar dados pessoais no storage. Se um dia
 * colidir, o servidor ainda compara o hash SHA-256 do payload e responde
 * 422, que descarta a tentativa.
 */
export function checkoutFingerprint(userId: string | null | undefined, input: unknown): string {
  const text = `${userId ?? ""}\u0000${checkoutSignature(input)}`;
  return `fp1-${cyrb53(text, 1)}${cyrb53(text, 2)}`;
}

/** window.sessionStorage, ou null (SSR, modo privado restrito, bloqueio). */
export function browserCheckoutAttemptStorage(): CheckoutAttemptStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Remove a tentativa guardada (sucesso confirmado ou recusa definitiva). */
export function clearCheckoutAttempt(storage: CheckoutAttemptStorage | null): void {
  try {
    storage?.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
  } catch {
    // Storage indisponível: nada a limpar.
  }
}

/**
 * Tentativa guardada para ESTA compra (mesmo fingerprint) e ainda válida;
 * qualquer outra coisa (usuário/payload diferente, expirada, corrompida)
 * é descartada e devolve null.
 */
export function loadCheckoutAttempt(
  storage: CheckoutAttemptStorage | null,
  fingerprint: string,
  now: number,
): CheckoutAttempt | null {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data === "object" && data !== null) {
      const { v, key, fingerprint: saved, expiresAt } = data as Record<string, unknown>;
      if (
        v === 1 &&
        typeof key === "string" &&
        KEY_FORMAT.test(key) &&
        saved === fingerprint &&
        typeof expiresAt === "number" &&
        expiresAt > now
      ) {
        return { key, signature: fingerprint, expiresAt };
      }
    }
  } catch {
    // JSON inválido: tratado como ausente.
  }
  clearCheckoutAttempt(storage);
  return null;
}

/** Grava a tentativa (best-effort: sem storage, vale só a memória). */
export function saveCheckoutAttempt(
  storage: CheckoutAttemptStorage | null,
  attempt: CheckoutAttempt,
): void {
  try {
    storage?.setItem(
      CHECKOUT_ATTEMPT_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        key: attempt.key,
        fingerprint: attempt.signature,
        expiresAt: attempt.expiresAt,
      }),
    );
  } catch {
    // Cota/bloqueio: segue com a tentativa em memória (useRef).
  }
}

/**
 * Tentativa a usar no envio atual: a guardada na aba (sobrevive ao
 * refresh) ou a em memória (storage indisponível), desde que seja da mesma
 * compra e não tenha expirado; senão uma nova. Renova a validade e grava.
 */
export function resumeCheckoutAttempt(options: {
  memory: CheckoutAttempt | null;
  storage: CheckoutAttemptStorage | null;
  fingerprint: string;
  now: number;
  ttlMs?: number;
  newKey?: () => string | null;
}): CheckoutAttempt | null {
  const { memory, storage, fingerprint, now } = options;
  const ttlMs = options.ttlMs ?? CHECKOUT_ATTEMPT_TTL_MS;
  const stored = loadCheckoutAttempt(storage, fingerprint, now);
  const inMemory =
    memory && memory.signature === fingerprint && (memory.expiresAt ?? 0) > now ? memory : null;
  const next = nextCheckoutAttempt(stored ?? inMemory, fingerprint, options.newKey);
  if (!next) {
    clearCheckoutAttempt(storage);
    return null;
  }
  const attempt: CheckoutAttempt = { key: next.key, signature: fingerprint, expiresAt: now + ttlMs };
  saveCheckoutAttempt(storage, attempt);
  return attempt;
}
