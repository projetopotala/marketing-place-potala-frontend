"use client";

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Truck,
  WalletCards,
  TicketPercent,
  Boxes,
  Star,
  Settings,
  PlusCircle,
} from "lucide-react";

export const SELLER_ICON_STROKE = 1.65;

export type SellerNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

function matchPath(href: string) {
  return (pathname: string) => {
    if (href === "/loja") return pathname === "/loja";
    return pathname === href || pathname.startsWith(`${href}/`);
  };
}

export const SELLER_NAVIGATION: SellerNavItem[] = [
  { id: "notificacoes", label: "Notificações", href: "/loja/notificacoes", icon: LayoutDashboard, match: matchPath("/loja/notificacoes") },
 {id:"documentos",label:"Documentos",href:"/loja/documentos",icon:Settings,match:matchPath("/loja/documentos")},
 {id:"atividades",label:"Cursos e eventos",href:"/loja/atividades",icon:LayoutDashboard,match:matchPath("/loja/atividades")},
  {
    id: "dashboard",
    label: "Painel",
    href: "/loja",
    icon: LayoutDashboard,
    match: matchPath("/loja"),
  },
  {
    id: "pedidos",
    label: "Pedidos",
    href: "/loja/pedidos",
    icon: ShoppingBag,
    match: matchPath("/loja/pedidos"),
  },
  {
    id: "produtos",
    label: "Produtos",
    href: "/loja/produtos",
    icon: Package,
    match: (pathname) =>
      pathname.startsWith("/loja/produtos") &&
      !pathname.startsWith("/loja/produtos/novo"),
  },
  {
    id: "novo-produto",
    label: "Novo produto",
    href: "/loja/produtos/novo",
    icon: PlusCircle,
    match: matchPath("/loja/produtos/novo"),
  },
  {
    id: "entregas",
    label: "Entregas",
    href: "/loja/entregas",
    icon: Truck,
    match: matchPath("/loja/entregas"),
  },
  {
    id: "financeiro",
    label: "Financeiro",
    href: "/loja/financeiro",
    icon: WalletCards,
    match: matchPath("/loja/financeiro"),
  },
  {
    id: "cupons",
    label: "Cupons",
    href: "/loja/cupons",
    icon: TicketPercent,
    match: matchPath("/loja/cupons"),
  },
  {
    id: "estoque",
    label: "Estoque",
    href: "/loja/estoque",
    icon: Boxes,
    match: matchPath("/loja/estoque"),
  },
  {
    id: "avaliacoes",
    label: "Avaliações",
    href: "/loja/avaliacoes",
    icon: Star,
    match: matchPath("/loja/avaliacoes"),
  },
  {
    id: "configuracoes",
    label: "Configurações",
    href: "/loja/configuracoes",
    icon: Settings,
    match: matchPath("/loja/configuracoes"),
  },
];
