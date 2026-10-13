"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { getAuthGuardRedirect } from "./authGuardPolicy";
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

  // Vendedor também compra com a mesma conta: não é redirecionado para
  // /loja (ver authGuardPolicy.ts). Só visitante -> /acesso e admin -> /admin.
  const redirectTo = getAuthGuardRedirect({
    isAuthenticated,
    role: user?.role,
  });

  useEffect(() => {
    if (!isHydrated) return;
    if (redirectTo) router.replace(redirectTo);
  }, [isHydrated, redirectTo, router]);

  if (!isHydrated) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <div className={styles.skeleton} />
        <p>Carregando sua conta…</p>
      </div>
    );
  }

  // Continua mostrando "Redirecionando…" enquanto o efeito acima ainda vai agir
  // (visitante anônimo ou admin).
  const willRedirectAway = redirectTo !== null;

  if (willRedirectAway) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <p>Redirecionando…</p>
      </div>
    );
  }

  return <>{children}</>;
}
