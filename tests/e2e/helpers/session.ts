import type { BrowserContext } from "@playwright/test";

/**
 * Sessão real de teste, via login de verdade contra identity-service (pelo
 * gateway) — substitui o esquema antigo de injetar uma sessão demo direto
 * no localStorage (`DEMO_SESSION_STORAGE_KEY`, removido do app desde a
 * integração real de `/acesso`, ver status-migracao-microservicos.md).
 *
 * Credenciais nunca ficam hardcoded aqui nem em nenhum spec — são lidas de
 * variáveis de ambiente, mesmo princípio já usado pelo próprio backend
 * (ADMIN_EMAIL/ADMIN_PASSWORD do seed do identity-service). Configure antes
 * de rodar `npx playwright test`:
 *
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD        — o admin seedado, ou
 *                                                  qualquer outro admin real
 *   E2E_SELLER_EMAIL / E2E_SELLER_PASSWORD      — uma loja com status ACTIVE
 *   E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD  — um cliente real
 *
 * Um teste cujo papel não tem as duas variáveis correspondentes é pulado
 * (`test.skip`), nunca falha com uma senha inventada nem tenta logar com
 * uma conta que não existe.
 */

export type TestRole = "admin" | "seller" | "customer";

interface Credentials {
  email: string;
  password: string;
}

function readCredentials(role: TestRole): Credentials | null {
  const prefix = role.toUpperCase();
  const email = process.env[`E2E_${prefix}_EMAIL`];
  const password = process.env[`E2E_${prefix}_PASSWORD`];
  if (!email || !password) return null;
  return { email, password };
}

export function hasCredentials(role: TestRole): boolean {
  return readCredentials(role) !== null;
}

export function credentialsOrThrow(role: TestRole): Credentials {
  const creds = readCredentials(role);
  if (!creds) {
    throw new Error(
      `Faltam E2E_${role.toUpperCase()}_EMAIL/E2E_${role.toUpperCase()}_PASSWORD no ambiente — configure antes de rodar os testes de ${role}.`,
    );
  }
  return creds;
}

/**
 * Mesma URL que o app usa em runtime (NEXT_PUBLIC_API_BASE_URL) — lida do
 * ambiente do processo que roda o Playwright, não do bundle do navegador
 * (o teste não passa pelo Next.js pra resolver essa variável).
 */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

/**
 * Loga de verdade via API (POST /auth/login), sem passar pela UI — setup
 * de teste não é o que o teste está validando (os specs que testam o
 * formulário de login em si continuam preenchendo a tela real, ver
 * `fillLoginForm` abaixo). O cookie HttpOnly de sessão fica no
 * `BrowserContext` e vale pra qualquer página que a partir daqui navegue
 * nesse mesmo contexto — cookie é escopado por host, não por porta, então
 * funciona igual mesmo com o gateway (8080) e o frontend (3100) em portas
 * diferentes do mesmo `localhost`, o mesmo comportamento que o app depende
 * em produção (domínios diferentes, `SameSite=None`).
 */
export async function loginAs(
  context: BrowserContext,
  role: TestRole,
): Promise<Credentials> {
  const creds = credentialsOrThrow(role);
  const response = await context.request.post(`${API_BASE_URL}/auth/login`, {
    data: { email: creds.email, password: creds.password },
  });
  if (!response.ok()) {
    throw new Error(
      `Login de teste (${role}, ${creds.email}) falhou: ${response.status()} ${await response.text()}`,
    );
  }
  return creds;
}

export async function logout(context: BrowserContext): Promise<void> {
  await context.clearCookies();
}
