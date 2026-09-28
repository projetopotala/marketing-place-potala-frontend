"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { Menu, Store } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SELLER_ICON_STROKE } from "@/components/seller/sellerNav";
import styles from "./seller.module.css";

interface SellerTopbarProps {
  onOpenMenu: () => void;
  menuOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  title?: string;
}

export function SellerTopbar({
  onOpenMenu,
  menuOpen,
  menuButtonRef,
  title = "Painel do vendedor",
}: SellerTopbarProps) {
  const { user } = useAuth();
  // Real desde esta sessão — vitrine pública real (ver
  // status-migracao-microservicos.md). Antes resolvia a loja por um lookup
  // em `AdminDataContext` (mock local, `db.sellers`), que nunca batia com
  // o `sellerId` real e caía sempre no mesmo slug de exemplo fixo,
  // apontando qualquer vendedor pra loja errada — bug real, corrigido
  // aqui. `sellerSlug` vem da sessão (ver types/auth.ts), resolvida junto
  // com sellerId/sellerCanOperate; ausente enquanto esse lookup ainda não
  // terminou (mesmo padrão de degradação de sellerId).
  const storeHref = user?.sellerSlug ? `/vendedor/${user.sellerSlug}` : null;

  return (
    <header className={styles.topbar}>
      <button
        ref={menuButtonRef}
        type="button"
        className={styles.menuBtn}
        aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menuOpen}
        aria-controls="seller-sidebar"
        onClick={onOpenMenu}
      >
        <Menu size={20} strokeWidth={SELLER_ICON_STROKE} aria-hidden="true" />
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p className={styles.pageLead} style={{ margin: 0 }}>
          {title}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "0.8rem",
            color: "var(--potala-text-secondary)",
          }}
        >
          {user?.email}
          {user?.sellerId ? ` · ${user.sellerId}` : ""}
        </p>
      </div>

      {storeHref ? (
        <Link href={storeHref} className={styles.ghostBtn}>
          <Store size={16} strokeWidth={SELLER_ICON_STROKE} aria-hidden="true" />
          Ver vitrine
        </Link>
      ) : null}
    </header>
  );
}
