"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./AuthGuard.module.css";

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Proteção apenas demonstrativa no frontend.
 * Em produção, a autorização deve ser validada no backend com sessão segura e cookie httpOnly.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated, isHydrated } = useAuth();

  // Só manda para /loja quando sellerId também resolveu — mesma exigência
  // do SellerAuthGuard. Sem isso, um SELLER cujo GET /seller/onboarding/status
  // falhou (sellers-service fora do ar) ficava preso num loop: esta guard
  // mandava para /loja por causa da role, e o SellerAuthGuard mandava de
  // volta para /minha-conta por causa do sellerId ausente.
  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.replace("/acesso");
      return;
    }
    if (user?.role === "seller" && user.sellerId) {
      router.replace("/loja");
      return;
    }
    if (user?.role === "admin") {
      router.replace("/admin");
    }
  }, [isAuthenticated, isHydrated, router, user?.role, user?.sellerId]);

  if (!isHydrated) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <div className={styles.skeleton} />
        <p>Carregando sua conta…</p>
      </div>
    );
  }

  // Continua redirecionando enquanto o efeito acima ainda vai agir
  // (visitante anônimo, admin, ou seller com sellerId resolvido). Um SELLER
  // sem sellerId não se encaixa em nenhum desses casos — cai direto para o
  // fallback de baixo em vez de ficar preso num "Redirecionando…" para
  // sempre (ver comentário no efeito acima).
  const willRedirectAway =
    !isAuthenticated ||
    user?.role === "admin" ||
    (user?.role === "seller" && Boolean(user.sellerId));

  if (willRedirectAway) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <p>Redirecionando…</p>
      </div>
    );
  }

  return <>{children}</>;
}
