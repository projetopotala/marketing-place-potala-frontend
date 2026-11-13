"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
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
  const pathname = usePathname();
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
  if (user.sellerCanOperate === false && pathname !== '/loja/documentos') {
    return (
      <div className={styles.guard} role="status" aria-live="polite">
        <div style={{ maxWidth: 420, textAlign: "center", display: "grid", gap: 12 }}>
          <h1 style={{ margin: 0 }}>Sua loja ainda não está liberada</h1>
          <p style={{ margin: 0 }}>
            Consulte os documentos e o histórico para acompanhar a análise e
            corrigir solicitações. O catálogo e as vendas dependem da aprovação
            da loja pelo Instituto Potala.
          </p>
          <Link href="/loja/documentos">Enviar documentos e acompanhar correções</Link>
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
