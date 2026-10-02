import { PRODUCTS } from "@/data/marketplace";
import type {
  AccountCoupon,
  AccountFavorite,
  AccountSidebarItem,
} from "@/types/account";

export const ACCOUNT_SIDEBAR_ITEMS: AccountSidebarItem[] = [
  { id: "resumo", label: "Resumo da Conta", href: "/minha-conta", available: true },
  {
    id: "pedidos",
    label: "Meus Pedidos",
    href: "/minha-conta/pedidos",
    available: true,
  },
  {
    id: "devolucoes",
    label: "Devoluções",
    href: "/minha-conta/devolucoes",
    available: true,
  },
  {
    id: "enderecos",
    label: "Endereços",
    href: "/minha-conta/enderecos",
    available: true,
  },
  {
    id: "favoritos",
    label: "Favoritos",
    href: "/minha-conta/favoritos",
    available: true,
  },
  {
    id: "avaliacoes",
    label: "Avaliações",
    href: "/minha-conta/avaliacoes",
    available: true,
  },
  {
    id: "cupons",
    label: "Cupons",
    href: "/minha-conta/cupons",
    available: true,
  },
  {
    id: "configuracoes",
    label: "Configurações",
    href: "/minha-conta/configuracoes",
    available: true,
  },
  {
    id: "ajuda",
    label: "Central de ajuda",
    href: "/minha-conta/ajuda",
    available: true,
  },
];

export const ACCOUNT_ACTIVE_COUPONS: AccountCoupon[] = [
  {
    id: "cp-1",
    code: "POTALA10",
    description: "10% em produtos selecionados",
    expiresAt: "30/09/2026",
  },
  {
    id: "cp-2",
    code: "FRETEGRATIS",
    description: "Frete grátis acima de R$ 199",
    expiresAt: "15/10/2026",
  },
];

/** Fallback estático — preferir `useAccountData().db.favorites`. */
export function getAccountFavorites(): AccountFavorite[] {
  return PRODUCTS.filter((product) =>
    ["japamala", "ametista-premium", "palo-santo", "poder-do-agora"].includes(
      product.slug,
    ),
  ).map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    imageSrc: product.imageSrc,
    price: product.price,
  }));
}

export const ACCOUNT_WELCOME_STATS = {
  memberSince: "Março de 2026",
  totalOrders: 6,
  totalSpent: 1248.5,
};

export const ACCOUNT_HELP_FAQS = [
  {
    id: "faq-1",
    category: "Pedidos",
    question: "Como acompanho meu pedido?",
    answer:
      "Em Minha conta → Meus pedidos você encontra o status e o histórico do seu pedido.",
  },
  {
    id: "faq-2",
    category: "Entrega",
    question: "Qual o prazo de entrega?",
    answer:
      "O prazo exibido depende da modalidade de envio escolhida no checkout.",
  },
  {
    id: "faq-3",
    category: "Devoluções",
    question: "Posso devolver um produto?",
    answer:
      "Pedidos com status Entregue podem abrir solicitação em Devoluções.",
  },
  {
    id: "faq-4",
    category: "Conta",
    question: "Esqueci minha senha",
    answer:
      "Para suporte relacionado ao acesso à sua conta, consulte os canais de contato do Instituto Potala disponíveis nesta página.",
  },
];
