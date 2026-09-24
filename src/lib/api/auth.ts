import { apiFetch, ApiError } from "./client";
import type { Session, UserRole } from "@/types/auth";

/** Mirrors identity-service's Prisma `Role` enum (auth.serializer.ts). */
type BackendRole = "CUSTOMER" | "SELLER" | "ADMIN";

/** Mirrors identity-service's PublicUser (auth.serializer.ts) — never includes passwordHash. */
interface PublicUser {
  id: string;
  email: string;
  status: "ACTIVE" | "BLOCKED" | "PENDING_VERIFICATION";
  roles: BackendRole[];
  createdAt: string;
}

interface UserProfile {
  id: string;
  fullName: string;
  phone: string | null;
}

interface LoginResponse {
  user: PublicUser;
}

interface MeResponse {
  user: PublicUser;
  profile: UserProfile | null;
  customer: { id: string } | null;
  admin: { id: string } | null;
}

interface SellerOnboardingStatus {
  sellerId: string;
  canOperate: boolean;
}

/**
 * Vários serviços deste backend rodam em instância free tier (Render), que
 * dorme após inatividade — a primeira chamada depois de um período ocioso
 * pode falhar ou demorar bem mais que o normal (cold start). Usado hoje por
 * dois pontos: o onboarding-status do vendedor logo abaixo (já existia) e
 * `login()` mais abaixo (novo — status-migracao-microservicos.md, item 8,
 * "Pendente": era o único dos dois sem proteção nenhuma — uma tentativa de
 * login com identity-service dormindo falhava direto com
 * "Ocorreu um erro inesperado.", sem chance de recuperar sozinho, o pior
 * cenário possível de cold start: ninguém consegue nem entrar no sistema).
 * Custo no caso comum (serviço já acordado): zero — a primeira tentativa
 * responde normal e o loop abaixo nunca chega a esperar.
 *
 * Só vale re-tentar erro de rede/infra (status 0 ou 5xx) — um 401 (senha
 * errada) ou um 404 (usuário SELLER sem `SellerMembership` ainda, edge case
 * já documentado abaixo) são respostas válidas e imediatas; repetir essas
 * só atrasaria à toa (e, no caso do login, mostraria a mensagem de erro
 * bem mais tarde do que devia).
 */
const COLD_START_RETRY_DELAYS_MS = [1500, 3000, 6000];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableInfraError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status === 0 || error.status >= 500;
}

/** Reexecuta `request` com backoff enquanto o erro for de rede/infra (ver isRetryableInfraError) — usado tanto pro onboarding-status quanto pro login, ambos sujeitos ao mesmo cold start de serviço no plano free do Render. */
async function retryOnColdStart<T>(request: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      const isLastAttempt = attempt >= COLD_START_RETRY_DELAYS_MS.length;
      if (isLastAttempt || !isRetryableInfraError(error)) {
        throw error;
      }
      await delay(COLD_START_RETRY_DELAYS_MS[attempt]);
    }
  }
}

async function fetchOnboardingStatusWithRetry(): Promise<SellerOnboardingStatus | null> {
  return retryOnColdStart(() =>
    apiFetch<SellerOnboardingStatus>("/seller/onboarding/status"),
  );
}

/** A user only ever holds one role in this system today (each registration flow assigns exactly one), but the field is an array — ADMIN/SELLER take precedence over CUSTOMER only as defensive ordering, not because multi-role users are expected. */
function toUserRole(roles: BackendRole[]): UserRole {
  if (roles.includes("ADMIN")) return "admin";
  if (roles.includes("SELLER")) return "seller";
  return "customer";
}

function displayName(user: PublicUser, profile: UserProfile | null): string {
  if (profile?.fullName.trim()) return profile.fullName.trim();
  // profile is null right after seller registration's compensating paths or
  // for an ADMIN seeded directly in the database with no UserProfile row —
  // falling back to the email's local part keeps the UI readable instead of
  // showing an empty name.
  return user.email.split("@")[0] ?? user.email;
}

async function buildSession(
  user: PublicUser,
  profile: UserProfile | null,
): Promise<Session> {
  const role = toUserRole(user.roles);
  const session: Session = {
    userId: user.id,
    email: user.email,
    name: displayName(user, profile),
    role,
  };

  if (role !== "seller") {
    return session;
  }

  try {
    const status = await fetchOnboardingStatusWithRetry();
    return {
      ...session,
      sellerId: status?.sellerId,
      sellerCanOperate: status?.canOperate,
    };
  } catch {
    // sellers-service ainda fora do ar depois das retentativas acima, ou
    // (edge case) um usuário SELLER sem membership row ainda —
    // SellerAuthGuard já redireciona uma sessão sem sellerId pra longe do
    // painel de vendedor, então degradar pra uma sessão sem sellerId aqui é
    // seguro em vez de falhar o login inteiro.
    return session;
  }
}

export async function registerCustomer(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<void> {
  await apiFetch("/auth/customer/register", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      phone: input.phone,
      password: input.password,
    }),
  });
}

/** Mirrors identity-service's DocumentType enum (common/types/document-type.ts). */
export type SellerDocumentType = "CPF" | "CNPJ";

/**
 * Mirrors identity-service's RegisterSellerDto exactly (auth/dto/register-seller.dto.ts).
 * This is a two-phase registration on the backend (local User row + a
 * synchronous handoff to sellers-service that creates Seller(PENDING) +
 * SellerMembership(OWNER)) — the caller here only sees the combined result,
 * not the two phases. No auto-login happens; the new seller logs in
 * separately afterwards, same as customer registration.
 */
export async function registerSeller(input: {
  email: string;
  password: string;
  ownerName: string;
  legalName: string;
  tradeName: string;
  documentType: SellerDocumentType;
  documentNumber: string;
  storeEmail: string;
  phone: string;
  description?: string;
}): Promise<void> {
  await apiFetch("/auth/seller/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<Session> {
  // login's own response carries no `profile` (see auth.controller.ts) — it
  // exists mainly to set the HttpOnly session cookie. The session this
  // function returns comes from a follow-up GET /auth/me (getSession, which
  // also resolves display name and, for a seller, sellerId), reusing the
  // exact same code path page-load hydration uses — a wrong-credentials
  // attempt throws ApiError(401) straight out of this first call, before
  // getSession() is ever reached (retryOnColdStart above does not retry a
  // 401 -- only status 0 / 5xx, so a genuinely wrong password still fails
  // immediately, same as before).
  await retryOnColdStart(() =>
    apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );

  const session = await getSession();
  if (!session) {
    // Login just succeeded (cookie set), so /auth/me returning "no session"
    // would mean the cookie the browser just received isn't being sent back
    // — a same-site/CORS misconfiguration between the frontend and the
    // gateway, not a credentials problem. Surfacing it distinctly avoids
    // reporting a cookie/CORS bug as "invalid credentials".
    throw new ApiError(
      0,
      "Login efetuado, mas não foi possível carregar a sessão. Verifique a configuração do navegador.",
    );
  }
  return session;
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

/** Returns null for an anonymous visitor (401) rather than throwing — that is the expected, common case on every page load. */
export async function getSession(): Promise<Session | null> {
  try {
    const me = await apiFetch<MeResponse>("/auth/me");
    if (!me) return null;
    return buildSession(me.user, me.profile);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}
