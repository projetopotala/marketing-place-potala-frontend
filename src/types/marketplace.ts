export type ProductBadge = "Mais vendido" | "Novo" | "Oferta";

export type ProductAction = "cart" | "details";

/** Modalidade do item público. Cursos não usam painel físico de frete. */
export type ProductModality = "physical" | "course";

export interface NavCategory {
  id: string;
  label: string;
  href: string;
  hasMenu?: boolean;
}

export interface CategoryHighlight {
  id: string;
  name: string;
  href: string;
  imageSrc: string;
  imageAlt: string;
  description?: string;
  productCount?: number;
}

export interface ProductImage {
  src: string;
  alt: string;
}

export interface ProductCharacteristic {
  label: string;
  value: string;
}

export interface ProductSeller {
  name: string;
  rating: number;
}

export interface ProductReviewItem {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  categoryId: string;
  price: number;
  rating: number;
  reviewCount: number;
  imageSrc: string;
  imageAlt: string;
  badge?: ProductBadge;
  action: ProductAction;
  /** Padrão implícito: physical. Cursos usam "course". */
  modality?: ProductModality;
  featured?: boolean;
  popular?: boolean;
  isNew?: boolean;
  sku?: string;
  description?: string;
  longDescription?: string;
  stock?: number;
  soldCount?: number;
  /** Id da variante padrão (catalog-service) — necessário pra adicionar ao carrinho real, ver POST /orders/checkout. Ausente em produtos que não vêm do catalog-service real. */
  defaultVariantId?: string;
  originalPrice?: number;
  discountPercent?: number;
  seller?: ProductSeller;
  images?: ProductImage[];
  characteristics?: ProductCharacteristic[];
  shippingSummary?: string[];
  paymentSummary?: string[];
  reviews?: ProductReviewItem[];
}

export interface CompactProduct {
  id: string;
  name: string;
  imageSrc: string;
  price: number;
  rating: number;
  reviewCount: number;
  href: string;
}

export interface PhilosophyPillar {
  id: string;
  title: string;
  description: string;
  icon: "products" | "knowledge" | "healing" | "community";
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  quote: string;
  rating: number;
  avatarSrc: string;
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface ContactInfo {
  phone: string;
  email: string;
  hours: string[];
}

export interface PaymentMethod {
  id: "visa" | "mastercard" | "elo" | "pix" | "boleto";
  label: string;
  imageSrc?: string;
}
