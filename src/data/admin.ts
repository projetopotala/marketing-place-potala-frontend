export type AdminNavChild = {
  id: string;
  label: string;
  href: string;
};

export type AdminNavItem = {
  id: string;
  label: string;
  href: string;
  children?: AdminNavChild[];
};

export const ADMIN_NAV: AdminNavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/admin" },
  { id: "vendedores", label: "Vendedores", href: "/admin/vendedores" },
  {
    id: "produtos",
    label: "Produtos",
    href: "/admin/produtos",
    children: [
      { id: "produtos-all", label: "Todos os produtos", href: "/admin/produtos" },
      { id: "catalogo", label: "Catálogo", href: "/admin/catalogo" },
      { id: "cupons", label: "Cupons", href: "/admin/cupons" },
    ],
  },
  { id: "pedidos", label: "Pedidos", href: "/admin/pedidos" },
  { id: "financeiro", label: "Financeiro", href: "/admin/financeiro" },
  { id: "clientes", label: "Clientes", href: "/admin/clientes" },
  { id: "devolucoes", label: "Devoluções", href: "/admin/devolucoes" },
  { id: "conteudos", label: "Conteúdos / Cursos", href: "/admin/conteudos" },
  { id: "administradores", label: "Administradores", href: "/admin/administradores" },
];
