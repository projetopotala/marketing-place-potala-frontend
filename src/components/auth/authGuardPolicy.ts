/**
 * Decisão de redirecionamento do AuthGuard (checkout + área "Minha conta"),
 * isolada numa função pura para ser testável sem React/Next.
 *
 * Regra: AuthGuard protege as telas de COMPRADOR. Um vendedor (role
 * "seller") também é comprador com a mesma conta -- o orders-service
 * identifica o comprador só por authUser.id, sem exigir CustomerProfile --
 * então ele NÃO é redirecionado para /loja. Só visitantes (-> /acesso) e
 * administradores (-> /admin, que não compram) saem daqui.
 *
 * O painel do vendedor continua protegido por SellerAuthGuard (/loja) e o
 * admin por AdminAuthGuard (/admin); nenhum deles foi alterado.
 */
export interface AuthGuardState {
  isAuthenticated: boolean;
  role?: "customer" | "seller" | "admin";
}

export type AuthGuardRedirect = "/acesso" | "/admin" | null;

export function getAuthGuardRedirect(state: AuthGuardState): AuthGuardRedirect {
  if (!state.isAuthenticated) return "/acesso";
  if (state.role === "admin") return "/admin";
  return null;
}
