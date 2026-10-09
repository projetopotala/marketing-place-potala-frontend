"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  MapPin,
  Heart,
  Star,
  TicketPercent,
  Settings,
  LogOut,
  Undo2,
  HelpCircle,
  MessageSquareWarning,
  type LucideIcon,
} from "lucide-react";
import { ACCOUNT_SIDEBAR_ITEMS } from "@/data/account";
import { useAuth } from "@/context/AuthContext";
import styles from "./AccountSidebar.module.css";

interface AccountSidebarProps {
  className?: string;
}

const ICONS: Record<string, LucideIcon> = {
  resumo: LayoutDashboard,
  pedidos: Package,
  devolucoes: Undo2,
  reclamacoes: MessageSquareWarning,
  enderecos: MapPin,
  favoritos: Heart,
  avaliacoes: Star,
  cupons: TicketPercent,
  configuracoes: Settings,
  ajuda: HelpCircle,
};

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  if (href === "/minha-conta") return pathname === "/minha-conta";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountSidebar({ className = "" }: AccountSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();

  function handleSignOut() {
    signOut();
    router.push("/acesso");
  }

  return (
    <aside className={`${styles.sidebar} ${className}`} aria-label="Menu da conta">
      <h2 className={styles.title}>Minha Conta</h2>
      <nav>
        <ul className={styles.list}>
          {ACCOUNT_SIDEBAR_ITEMS.map((item) => {
            const Icon = ICONS[item.id] ?? LayoutDashboard;
            const active = isActive(pathname, item.href);
            if (item.available && item.href) {
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={`${styles.link} ${active ? styles.active : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            }

            return null;
          })}
        </ul>
      </nav>

      <div className={styles.help}>
        <h3>Precisa de ajuda?</h3>
        <p>Nossa equipe acompanha sua jornada com cuidado e presença.</p>
        <Link href="/minha-conta/ajuda" className={styles.support}>
          Central de ajuda
        </Link>
        <button type="button" className={styles.logout} onClick={handleSignOut}>
          <LogOut size={16} strokeWidth={1.7} aria-hidden="true" />
          Sair
        </button>
      </div>
    </aside>
  );
}
