"use client";

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Store,
  Package,
  ShoppingBag,
  Truck,
  WalletCards,
  Users,
  BookOpen,
  ChartNoAxesCombined,
  Settings,
  Tags,
  TicketPercent,
  Plug,
  HandCoins,
  LogOut,
} from "lucide-react";
import { ADMIN_NAV, type AdminNavItem } from "@/data/admin";

export type AdminNavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Correspondência de rota ativa (pathname). */
  match: (pathname: string) => boolean;
  children?: Array<{
    id: string;
    label: string;
    href: string;
    icon?: LucideIcon;
    match: (pathname: string) => boolean;
  }>;
  /** Reserva para RBAC futuro — não aplicado no protótipo. */
  permission?: "admin";
};

function matchExactOrChild(href: string) {
  return (pathname: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  };
}

const ICON_BY_ID: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  vendedores: Store,
  produtos: Package,
  catalogo: Tags,
  cupons: TicketPercent,
  pedidos: ShoppingBag,
  entregas: Truck,
  financeiro: WalletCards,
  "fin-overview": WalletCards,
  "fin-integracoes": Plug,
  "fin-repasses": HandCoins,
  clientes: Users,
  conteudos: BookOpen,
  relatorios: ChartNoAxesCombined,
  configuracoes: Settings,
};

export const ADMIN_NAVIGATION: AdminNavigationItem[] = ADMIN_NAV.map(
  (item: AdminNavItem) => ({
    id: item.id,
    label: item.label,
    href: item.href,
    icon: ICON_BY_ID[item.id] ?? LayoutDashboard,
    match: matchExactOrChild(item.href),
    permission: "admin",
    children: item.children?.map((child) => ({
      ...child,
      icon: ICON_BY_ID[child.id],
      match: matchExactOrChild(child.href),
    })),
  }),
);

export const AdminLogoutIcon = LogOut;
export const ADMIN_ICON_STROKE = 1.75;
