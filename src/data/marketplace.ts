import {
  CATALOG_CATEGORIES,
  HEADER_CATEGORIES,
} from "@/features/catalog/categories";
import type {
  CategoryHighlight,
  ContactInfo,
  FooterColumn,
  NavCategory,
  PaymentMethod,
  PhilosophyPillar,
  Product,
  ProductImage,
  Testimonial,
} from "@/types/marketplace";

/**
 * Catálogo público demonstrativo (fonte canônica da vitrine).
 * Preços e estoques são fictícios para demonstração.
 * Novos registros aqui NÃO sincronizam automaticamente com o CRUD admin/vendedor.
 */

export const ANNOUNCEMENT_TEXT =
  "Frete grátis para todo o Brasil em compras acima de R$ 299";

export const BRAND = {
  name: "Instituto Potala",
  marketplace: "Marketplace",
  fullName: "Instituto Potala Marketplace",
  description:
    "Um espaço de luz e consciência para apoiar sua jornada de transformação.",
  logoSrc: "/images/potala/logo-mark.png",
};

/** Links da barra superior (desktop). Categorias do disclosure vêm de HEADER_CATEGORIES. */
export const NAV_CATEGORIES: NavCategory[] = [
  { id: "categorias", label: "Categorias", href: "/catalogo", hasMenu: true },
  ...HEADER_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.name,
    href: category.href,
  })),
  { id: "novidades", label: "Novidades", href: "/novidades" },
  // "Ofertas" removido da navegação nesta sessão — ver
  // src/app/(storefront)/ofertas/page.tsx pro porquê (sem preço
  // promocional real no backend).
];

export const PRODUCTS: Product[] = [
  {
    id: "ametista-premium",
    slug: "ametista-premium",
    name: "Drusa de Ametista Premium",
    category: "Cristais",
    categoryId: "cristais",
    price: 249.9,
    originalPrice: 299.9,
    discountPercent: 17,
    rating: 4.9,
    reviewCount: 28,
    soldCount: 142,
    imageSrc: "/images/potala/product-ametista-final.png",
    imageAlt: "Drusa de Ametista Premium",
    badge: "Mais vendido",
    action: "cart",
    featured: true,
    popular: true,
    sku: "POT-CRI-001",
    stock: 18,
    description:
      "Drusa de ametista selecionada para meditação, proteção e harmonização dos ambientes.",
    seller: { name: "Instituto Potala", rating: 4.9 },
    images: [
      {
        src: "/images/potala/product-ametista-final.png",
        alt: "Drusa de Ametista Premium",
      },
    ],
  },
  {
    id: "palo-santo",
    slug: "palo-santo",
    name: "Incenso Natural Palo Santo",
    category: "Incensos",
    categoryId: "incensos",
    price: 39.9,
    rating: 4.8,
    reviewCount: 96,
    soldCount: 510,
    imageSrc: "/images/potala/product-palo-santo-final.png",
    imageAlt: "Incenso Natural Palo Santo",
    action: "cart",
    featured: true,
    popular: true,
    sku: "POT-INC-014",
    stock: 84,
    description:
      "Palo Santo natural para limpeza energética e rituais de presença.",
    seller: { name: "Instituto Potala", rating: 4.9 },
    images: [
      {
        src: "/images/potala/product-palo-santo-final.png",
        alt: "Incenso Natural Palo Santo",
      },
    ],
  },
  {
    id: "curso-meditacao",
    slug: "curso-meditacao",
    name: "Curso Meditação e Atenção Plena",
    category: "Cursos",
    categoryId: "cursos",
    price: 297,
    rating: 5,
    reviewCount: 156,
    soldCount: 890,
    imageSrc: "/images/potala/product-curso-meditacao-final.png",
    imageAlt: "Curso Meditação e Atenção Plena",
    badge: "Novo",
    action: "details",
    modality: "course",
    featured: true,
    isNew: true,
    sku: "POT-CUR-008",
    stock: 999,
    description:
      "Programa demonstrativo para cultivar atenção plena e profundidade na prática meditativa. Inscrição e acesso às aulas ainda não estão integrados.",
    longDescription:
      "Este programa demonstrativo apresenta módulos introdutórios de meditação e atenção plena, com orientações de respiração, postura e presença no cotidiano. Os conteúdos abaixo são ilustrativos para a vitrine; inscrição, pagamento de curso e acesso às aulas ainda não estão integrados nesta etapa do marketplace.",
    seller: { name: "Instituto Potala", rating: 5 },
    images: [
      {
        src: "/images/potala/product-curso-meditacao-final.png",
        alt: "Curso Meditação e Atenção Plena",
      },
    ],
    characteristics: [
      { label: "Formato", value: "Online — demonstrativo" },
      { label: "Duração", value: "6 semanas (conteúdo ilustrativo)" },
      { label: "Módulos", value: "Fundamentos, respiração, presença e integração" },
      { label: "Acesso", value: "Inscrição/aulas ainda não integradas" },
    ],
  },
  {
    id: "poder-do-agora",
    slug: "poder-do-agora",
    name: "O Poder do Agora",
    category: "Livros",
    categoryId: "livros",
    price: 59.9,
    rating: 4.9,
    reviewCount: 75,
    soldCount: 320,
    imageSrc: "/images/potala/product-livro-agora-final.png",
    imageAlt: "O Poder do Agora",
    action: "cart",
    featured: true,
    popular: true,
    sku: "POT-LIV-022",
    stock: 47,
    description:
      "Obra clássica de Eckhart Tolle sobre presença e consciência.",
    seller: { name: "Instituto Potala", rating: 4.9 },
    images: [
      {
        src: "/images/potala/product-livro-agora-final.png",
        alt: "O Poder do Agora",
      },
    ],
  },
  {
    id: "japamala",
    slug: "japamala",
    name: "Pulseira Japamala 108 Contas",
    category: "Acessórios",
    categoryId: "acessorios",
    price: 129.9,
    originalPrice: 159.9,
    discountPercent: 19,
    rating: 4.7,
    reviewCount: 64,
    soldCount: 238,
    imageSrc: "/images/potala/product-japamala-final.png",
    imageAlt: "Pulseira Japamala 108 Contas",
    action: "cart",
    featured: true,
    sku: "POT-ACE-108",
    stock: 26,
    description:
      "Japamala artesanal com 108 contas para mantras, meditação e presença no cotidiano.",
    longDescription:
      "Este japamala foi confeccionado com 108 contas selecionadas para apoiar práticas de mantra, respiração e meditação. O fio resistente e o acabamento cuidadoso permitem uso diário como pulseira ou colar de prática. Ideal para quem busca um objeto de apoio na jornada espiritual, com estética serena e proporção confortável no pulso.",
    seller: { name: "Instituto Potala", rating: 4.9 },
    images: [
      {
        src: "/images/potala/product-japamala-final.png",
        alt: "Pulseira Japamala 108 Contas em vista principal",
      },
      {
        src: "/images/potala/product-ametista-final.png",
        alt: "Detalhe das contas do japamala em composição com ametista",
      },
      {
        src: "/images/potala/product-palo-santo-final.png",
        alt: "Japamala em contexto de ritual com Palo Santo",
      },
      {
        src: "/images/potala/discovery-kit-limpeza-final.png",
        alt: "Japamala ao lado de itens de limpeza energética",
      },
    ],
    characteristics: [
      { label: "Contas", value: "108 contas artesanais" },
      { label: "Uso", value: "Pulseira ou colar de prática" },
      { label: "Material", value: "Madeira e fio de alta resistência" },
      { label: "Origem", value: "Seleção consciente Instituto Potala" },
      { label: "Cuidados", value: "Evitar água em excesso e perfumes" },
    ],
    shippingSummary: [
      "Frete calculado no checkout conforme CEP",
      "Envio em até 2 dias úteis após confirmação",
      "Embalagem cuidadosa para proteção do produto",
    ],
    paymentSummary: [
      "Pix com confirmação imediata",
      "Cartões Visa, Mastercard e Elo",
      "Boleto bancário em até 1 dia útil",
    ],
    reviews: [
      {
        id: "jp-1",
        author: "Marina S.",
        rating: 5,
        date: "12/03/2026",
        comment:
          "Contas bem acabadas e confortáveis no pulso. Uso todos os dias na meditação.",
      },
      {
        id: "jp-2",
        author: "Carlos H.",
        rating: 4,
        date: "28/02/2026",
        comment:
          "Chegou rápido e com embalagem caprichada. O tamanho ficou perfeito.",
      },
      {
        id: "jp-3",
        author: "Helena P.",
        rating: 5,
        date: "10/02/2026",
        comment:
          "Bonito, leve e com presença. Recomendo para quem está iniciando mantras.",
      },
    ],
  },
  {
    id: "quartzo",
    slug: "quartzo-transparente",
    name: "Cristal de Quartzo Transparente",
    category: "Cristais",
    categoryId: "cristais",
    price: 89.9,
    rating: 4.8,
    reviewCount: 156,
    soldCount: 402,
    imageSrc: "/images/potala/product-quartzo.jpg",
    imageAlt: "Placeholder temporário: Cristal de Quartzo Transparente",
    action: "cart",
    popular: true,
    sku: "POT-CRI-017",
    stock: 33,
    description:
      "Quartzo transparente para clareza mental e amplificação de intenções.",
    seller: { name: "Instituto Potala", rating: 4.8 },
    images: [
      {
        src: "/images/potala/product-quartzo.jpg",
        alt: "Cristal de Quartzo Transparente",
      },
    ],
  },
  {
    id: "lavanda",
    slug: "oleo-lavanda",
    name: "Óleo Essencial de Lavanda 10ml",
    category: "Terapias",
    categoryId: "terapias",
    price: 44.9,
    rating: 4.6,
    reviewCount: 73,
    soldCount: 265,
    imageSrc: "/images/potala/product-lavanda.jpg",
    imageAlt: "Placeholder temporário: Óleo Essencial de Lavanda 10ml",
    action: "cart",
    popular: true,
    sku: "POT-TER-010",
    stock: 61,
    description:
      "Óleo essencial de lavanda para relaxamento e rituais de bem-estar.",
    seller: { name: "Instituto Potala", rating: 4.7 },
    images: [
      {
        src: "/images/potala/product-lavanda.jpg",
        alt: "Óleo Essencial de Lavanda 10ml",
      },
    ],
  },
  {
    id: "kit-limpeza",
    slug: "kit-limpeza-energetica",
    name: "Kit Limpeza Energética",
    category: "Meditação",
    categoryId: "meditacao",
    price: 119.9,
    rating: 4.9,
    reviewCount: 64,
    soldCount: 188,
    imageSrc: "/images/potala/product-kit-limpeza.jpg",
    imageAlt: "Placeholder temporário: Kit Limpeza Energética",
    badge: "Novo",
    action: "cart",
    isNew: true,
    sku: "POT-MED-005",
    stock: 22,
    description:
      "Kit completo para limpeza energética de ambientes e práticas pessoais.",
    seller: { name: "Instituto Potala", rating: 4.9 },
    images: [
      {
        src: "/images/potala/product-kit-limpeza.jpg",
        alt: "Kit Limpeza Energética",
      },
    ],
  },
  {
    id: "sino-tibetano",
    slug: "sino-tibetano",
    name: "Sino Tibetano 7 Metais",
    category: "Meditação",
    categoryId: "meditacao",
    price: 179.9,
    rating: 4.8,
    reviewCount: 51,
    soldCount: 97,
    imageSrc: "/images/potala/product-sino.jpg",
    imageAlt: "Placeholder temporário: Sino Tibetano 7 Metais",
    badge: "Novo",
    action: "cart",
    isNew: true,
    sku: "POT-MED-012",
    stock: 14,
    description:
      "Sino tibetano de sete metais para abertura e fechamento de práticas. Catálogo e preços demonstrativos.",
    seller: { name: "Instituto Potala", rating: 4.8 },
    images: [
      {
        src: "/images/potala/product-sino.jpg",
        alt: "Sino Tibetano 7 Metais",
      },
    ],
  },
  {
    id: "curso-chakras",
    slug: "curso-chakras",
    name: "Curso Chakras e Equilíbrio Energético",
    category: "Cursos",
    categoryId: "cursos",
    price: 297,
    rating: 0,
    reviewCount: 0,
    soldCount: 0,
    imageSrc: "/images/potala/discovery-curso-chakras-final.png",
    imageAlt:
      "Ilustração demonstrativa do Curso Chakras e Equilíbrio Energético",
    badge: "Novo",
    action: "details",
    modality: "course",
    isNew: true,
    sku: "POT-CUR-012",
    stock: 999,
    description:
      "Programa demonstrativo sobre centros energéticos e práticas de equilíbrio. Inscrição e acesso às aulas ainda não estão integrados.",
    longDescription:
      "Conteúdo demonstrativo que apresenta uma visão introdutória dos chakras e práticas suaves de percepção corporal e respiração. Não promete cura, tratamento clínico nem resultados garantidos. Inscrição e acesso às aulas ainda não estão integrados nesta etapa.",
    seller: { name: "Instituto Potala", rating: 5 },
    images: [
      {
        src: "/images/potala/discovery-curso-chakras-final.png",
        alt: "Ilustração demonstrativa do Curso Chakras e Equilíbrio Energético",
      },
    ],
    characteristics: [
      { label: "Formato", value: "Online — demonstrativo" },
      { label: "Duração", value: "8 semanas (conteúdo ilustrativo)" },
      {
        label: "Programa",
        value:
          "Introdução aos centros, percepção corporal, respiração e integração cotidiana",
      },
      { label: "Acesso", value: "Inscrição/aulas ainda não integradas" },
    ],
  },
  {
    id: "kit-aromatico-lavanda",
    slug: "kit-aromatico-lavanda",
    name: "Kit Aromático de Lavanda",
    category: "Terapias",
    categoryId: "terapias",
    price: 79.9,
    rating: 0,
    reviewCount: 0,
    soldCount: 0,
    imageSrc: "/images/potala/product-lavanda.jpg",
    imageAlt:
      "Imagem ilustrativa de lavanda — não é fotografia exata de todo o kit",
    action: "cart",
    modality: "physical",
    sku: "POT-TER-018",
    stock: 40,
    description:
      "Kit demonstrativo com óleo essencial de lavanda 10ml, sachê aromático e guia de uso sugerido. Preços e estoque são fictícios.",
    longDescription:
      "Composição demonstrativa do kit: (1) frasco de óleo essencial de lavanda 10ml; (2) sachê aromático de lavanda seca; (3) cartão com orientações básicas de uso em ambientação. A imagem exibida é ilustrativa de lavanda e não representa uma fotografia exata de todos os itens juntos. Uso destinado a bem-estar e rituais de presença — sem alegação de tratamento clínico.",
    seller: { name: "Instituto Potala", rating: 4.7 },
    images: [
      {
        src: "/images/potala/product-lavanda.jpg",
        alt: "Imagem ilustrativa de lavanda para o Kit Aromático",
      },
      {
        src: "/images/potala/discovery-oleo-lavanda-final.png",
        alt: "Ilustração complementar de óleo de lavanda",
      },
    ],
    characteristics: [
      { label: "Composição", value: "Óleo 10ml + sachê + guia ilustrativo" },
      { label: "Volume do óleo", value: "10 ml" },
      { label: "Uso sugerido", value: "Ambientação e rituais de presença" },
      {
        label: "Observação",
        value: "Imagem ilustrativa — não é foto exata do kit completo",
      },
    ],
    shippingSummary: [
      "Frete calculado no checkout conforme CEP",
      "Envio em até 2 dias úteis após confirmação (demonstrativo)",
      "Embalagem cuidadosa para proteção do produto",
    ],
    paymentSummary: [
      "Pix com confirmação imediata",
      "Cartões Visa, Mastercard e Elo",
      "Boleto bancário em até 1 dia útil",
    ],
  },
  {
    id: "livro-despertar",
    slug: "livro-despertar",
    name: "Livro O Despertar da Consciência",
    category: "Livros",
    categoryId: "livros",
    price: 49.9,
    rating: 0,
    reviewCount: 0,
    soldCount: 0,
    imageSrc: "/images/potala/discovery-livro-despertar-final.png",
    imageAlt: "Capa demonstrativa do Livro O Despertar da Consciência",
    action: "cart",
    modality: "physical",
    sku: "POT-LIV-031",
    stock: 55,
    description:
      "Título demonstrativo de leitura sobre presença e consciência. Dados e preço fictícios para a vitrine.",
    longDescription:
      "Obra demonstrativa da vitrine Potala sobre temas de presença e consciência interior. Não inventamos autor, editora nem depoimentos reais neste registro. Ideal como exemplo de listagem de livros físicos no marketplace.",
    seller: { name: "Instituto Potala", rating: 4.9 },
    images: [
      {
        src: "/images/potala/discovery-livro-despertar-final.png",
        alt: "Capa demonstrativa do Livro O Despertar da Consciência",
      },
    ],
    characteristics: [
      { label: "Formato", value: "Livro impresso (demonstrativo)" },
      { label: "Idioma", value: "Português" },
      { label: "Páginas", value: "Indicativo — dado ilustrativo" },
    ],
    shippingSummary: [
      "Frete calculado no checkout conforme CEP",
      "Envio em até 2 dias úteis após confirmação (demonstrativo)",
    ],
    paymentSummary: [
      "Pix com confirmação imediata",
      "Cartões Visa, Mastercard e Elo",
    ],
  },
  {
    id: "incenso-7-ervas",
    slug: "incenso-7-ervas",
    name: "Incenso Natural 7 Ervas Sagradas",
    category: "Incensos",
    categoryId: "incensos",
    price: 36.9,
    rating: 0,
    reviewCount: 0,
    soldCount: 0,
    imageSrc: "/images/potala/discovery-incenso-7-ervas-final.png",
    imageAlt: "Incenso Natural 7 Ervas Sagradas — imagem demonstrativa",
    action: "cart",
    modality: "physical",
    sku: "POT-INC-021",
    stock: 90,
    description:
      "Incenso natural de blend demonstrativo com sete ervas. Uso para ambientação — sem alegação terapêutica clínica.",
    longDescription:
      "Blend demonstrativo de sete ervas aromáticas para ambientação e rituais de quietude. Composição e propriedades são ilustrativas; não há promessa de cura ou eficácia clínica. Preço e estoque são fictícios para a vitrine.",
    seller: { name: "Instituto Potala", rating: 4.8 },
    images: [
      {
        src: "/images/potala/discovery-incenso-7-ervas-final.png",
        alt: "Incenso Natural 7 Ervas Sagradas",
      },
    ],
    characteristics: [
      { label: "Tipo", value: "Incenso natural (demonstrativo)" },
      { label: "Blend", value: "Sete ervas — composição ilustrativa" },
      { label: "Uso", value: "Ambientação e rituais de presença" },
    ],
    shippingSummary: [
      "Frete calculado no checkout conforme CEP",
      "Envio em até 2 dias úteis após confirmação (demonstrativo)",
    ],
    paymentSummary: [
      "Pix com confirmação imediata",
      "Cartões Visa, Mastercard e Elo",
    ],
  },
  {
    id: "caderno-mantras",
    slug: "caderno-mantras",
    name: "Caderno de Mantras",
    category: "Acessórios",
    categoryId: "acessorios",
    price: 39.9,
    rating: 0,
    reviewCount: 0,
    soldCount: 0,
    imageSrc: "/images/potala/discovery-caderno-mantras-final.png",
    imageAlt: "Caderno de Mantras — imagem demonstrativa",
    badge: "Novo",
    action: "cart",
    modality: "physical",
    isNew: true,
    sku: "POT-ACE-044",
    stock: 70,
    description:
      "Caderno demonstrativo para anotações de mantras e práticas. Preço e estoque fictícios.",
    longDescription:
      "Caderno pautado demonstrativo para registrar mantras, intenções e reflexões da prática. Acabamento e número de páginas são ilustrativos. Sem avaliações reais cadastradas neste registro.",
    seller: { name: "Instituto Potala", rating: 4.9 },
    images: [
      {
        src: "/images/potala/discovery-caderno-mantras-final.png",
        alt: "Caderno de Mantras",
      },
    ],
    characteristics: [
      { label: "Formato", value: "Caderno pautado (demonstrativo)" },
      { label: "Uso", value: "Anotações de mantras e práticas" },
      { label: "Acabamento", value: "Capa ilustrativa da vitrine" },
    ],
    shippingSummary: [
      "Frete calculado no checkout conforme CEP",
      "Envio em até 2 dias úteis após confirmação (demonstrativo)",
    ],
    paymentSummary: [
      "Pix com confirmação imediata",
      "Cartões Visa, Mastercard e Elo",
    ],
  },
];

/** Cards da home — derivados das categorias centrais + contagem real de PRODUCTS. */
export const FEATURED_CATEGORIES: CategoryHighlight[] = CATALOG_CATEGORIES.map(
  (category) => ({
    id: category.id,
    name: category.name,
    href: category.href,
    imageSrc: category.imageSrc,
    imageAlt: category.imageAlt,
    description: category.description,
    productCount: PRODUCTS.filter((p) => p.categoryId === category.id).length,
  }),
);

export const PHILOSOPHY_PILLARS: PhilosophyPillar[] = [
  {
    id: "produtos",
    title: "Produtos Conscientes",
    description: "Selecionados com propósito e amor.",
    icon: "products",
  },
  {
    id: "saber",
    title: "Saber que Transforma",
    description: "Conteúdos e cursos para expandir.",
    icon: "knowledge",
  },
  {
    id: "cura",
    title: "Cura que Acolhe",
    description: "Terapias e práticas para o bem-estar.",
    icon: "healing",
  },
  {
    id: "comunidade",
    title: "Comunidade que Inspira",
    description: "Conexão, troca e evolução coletiva.",
    icon: "community",
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "ana",
    name: "Ana Beatriz",
    location: "São Paulo, SP",
    quote:
      "Os cristais e os cursos do Instituto Potala trouxeram mais presença e calma para a minha rotina. A qualidade dos produtos é notável.",
    rating: 5,
    avatarSrc: "/images/potala/avatar-1.jpg",
  },
  {
    id: "rafael",
    name: "Rafael Mendes",
    location: "Curitiba, PR",
    quote:
      "Comprei o kit de limpeza energética e o sino tibetano. Chegaram com cuidado e a experiência de compra foi simples e acolhedora.",
    rating: 5,
    avatarSrc: "/images/potala/avatar-2.jpg",
  },
  {
    id: "lucia",
    name: "Lúcia Ferreira",
    location: "Belo Horizonte, MG",
    quote:
      "Encontrei livros e incensos que uso diariamente nas minhas práticas. Sinto a identidade espiritual do Instituto em cada detalhe.",
    rating: 5,
    avatarSrc: "/images/potala/avatar-3.jpg",
  },
];

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Institucional",
    links: [
      { label: "Sobre o Instituto Potala", href: "/#filosofia" },
      { label: "Nossa Filosofia", href: "/#filosofia" },
      { label: "Blog", href: "/#newsletter" },
      { label: "Trabalhe Conosco", href: "/#contato" },
      { label: "Seja um Parceiro", href: "/#contato" },
    ],
  },
  {
    title: "Ajuda",
    links: [
      { label: "Central de Ajuda", href: "/minha-conta/ajuda" },
      { label: "Como Comprar", href: "/catalogo" },
      { label: "Trocas e Devoluções", href: "/minha-conta/devolucoes" },
      { label: "Formas de Pagamento", href: "/#contato" },
      { label: "Política de Privacidade", href: "/#contato" },
    ],
  },
  {
    title: "Minha Conta",
    links: [
      { label: "Meus Pedidos", href: "/minha-conta/pedidos" },
      { label: "Lista de Desejos", href: "/minha-conta/favoritos" },
      { label: "Cursos e Conteúdos", href: "/categoria/cursos" },
      { label: "Meus Endereços", href: "/minha-conta/enderecos" },
      { label: "Minha Conta", href: "/minha-conta" },
    ],
  },
];

export const CONTACT_INFO: ContactInfo = {
  phone: "(11) 98765-4321",
  email: "contato@institutopotala.com.br",
  hours: ["Seg. a sex.: 9h às 18h", "Sáb.: 9h às 13h"],
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "visa",
    label: "Visa",
    imageSrc: "/images/potala/pay-visa.png",
  },
  {
    id: "mastercard",
    label: "Mastercard",
    imageSrc: "/images/potala/pay-master.png",
  },
  {
    id: "elo",
    label: "Elo",
    imageSrc: "/images/potala/pay-elo.png",
  },
  {
    id: "pix",
    label: "Pix",
    imageSrc: "/images/potala/pay-pix.png",
  },
  {
    id: "boleto",
    label: "Boleto",
    imageSrc: "/images/potala/pay-boleto.png",
  },
];

export const SOCIAL_LINKS = [
  { id: "instagram", label: "Instagram", href: null },
  { id: "facebook", label: "Facebook", href: null },
  { id: "youtube", label: "YouTube", href: null },
  { id: "pinterest", label: "Pinterest", href: null },
] as const;

export function formatPrice(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function getFeaturedProducts(): Product[] {
  return PRODUCTS.filter((product) => product.featured);
}

export function getPopularProducts(): Product[] {
  return PRODUCTS.filter((product) => product.popular);
}

export function getNewProducts(): Product[] {
  return PRODUCTS.filter((product) => product.isNew === true);
}

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
  const sameCategory = PRODUCTS.filter(
    (item) => item.categoryId === product.categoryId && item.id !== product.id,
  );

  if (sameCategory.length >= limit) {
    return sameCategory.slice(0, limit);
  }

  const extras = PRODUCTS.filter(
    (item) =>
      item.id !== product.id &&
      !sameCategory.some((related) => related.id === item.id),
  );

  return [...sameCategory, ...extras].slice(0, limit);
}

export function getProductImages(product: Product): ProductImage[] {
  if (product.images && product.images.length > 0) {
    return product.images;
  }

  return [{ src: product.imageSrc, alt: product.imageAlt || product.name }];
}
