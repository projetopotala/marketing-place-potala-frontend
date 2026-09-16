"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./seller.module.css";

interface SellerAuthGuardProps {
  children: ReactNode;
}

/**
 * Autorização real: role/sellerId vêm da sessão de verdade (AuthContext),
 * resolvida contra identity-service + sellers-service. O painel em si ainda
 * mistura dados reais (produtos) com dados demo (pedidos, financeiro etc.)
 * — essa mistura é decisão deliberada, não desta guard.
 */
export function SellerAuthGuard({ children }: SellerAuthGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated, isHydrated, signOut } = useAuth();

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.replace("/acesso");
      return;
    }

    if (user?.role === "admin") {
      router.replace("/admin");
      return;
    }

    if (user?.role !== "seller" || !user.sellerId) {
      router.replace("/minha-conta");
    }
  }, [isAuthenticated, isHydrated, router, user?.role, user?.sellerId]);

  if (!isHydrated) {
    return (
      <div className={styles.guard} role="status" aria-live="polite">
        <p>Carregando painel do vendedor…</p>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "seller" || !user.sellerId) {
    return (
      <div className={styles.guard} role="status" aria-live="polite">
        <p>Redirecionando…</p>
      </div>
    );
  }

  // canOperate === false cobre PENDING/REJECTED/SUSPENDED — catalog-service
  // rejeitaria (403) qualquer chamada a /seller/products nesse estado, então
  // a guard intercepta antes de renderizar um painel que só mostraria erros.
  if (user.sellerCanOperate === false) {
    return (
      <div className={styles.guard} role="status" aria-live="polite">
        <div style={{ maxWidth: 420, textAlign: "center", display: "grid", gap: 12 }}>
          <h1 style={{ margin: 0 }}>Sua loja está em análise</h1>
          <p style={{ margin: 0 }}>
            O cadastro foi recebido e aguarda aprovação do time do Instituto
            Potala. Você recebe acesso ao painel assim que sua loja for
            aprovada.
          </p>
          <button
            type="button"
            onClick={() => {
              signOut();
              router.push("/acesso");
            }}
            style={{
              justifySelf: "center",
              background: "transparent",
              border: "1px solid var(--seller-border)",
              borderRadius: 8,
              padding: "8px 16px",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
