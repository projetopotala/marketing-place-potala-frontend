"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { Product } from "@/types/marketplace";
import { formatPrice } from "@/data/marketplace";
import {
  getDiscountPercent,
  isCourseProduct,
  isOnOffer,
} from "@/features/catalog/selectors";
import { useCart } from "@/context/CartContext";
import {
  CartIcon,
  ClockIcon,
  MinusIcon,
  PlusIcon,
  StarIcon,
  TruckIcon,
} from "@/components/storefront/icons";
import styles from "./ProductPurchasePanel.module.css";

interface ProductPurchasePanelProps {
  product: Product;
}

export function ProductPurchasePanel({ product }: ProductPurchasePanelProps) {
  const router = useRouter();
  const { addItem, isReady } = useCart();
  const isCourse = isCourseProduct(product);
  const stock = Math.floor(product.stock ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [cep, setCep] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const quantityId = useId();
  const cepId = useId();
  const feedbackId = useId();
  const onOffer = isOnOffer(product);
  const discountPercent = getDiscountPercent(product);

  function decrease() {
    setQuantity((current) => Math.max(1, current - 1));
  }

  function increase() {
    setQuantity((current) => Math.min(Math.max(stock, 1), current + 1));
  }

  // Produtos vindos do catalog-service real sempre têm ao menos 1 variante
  // (CreateProductDto exige >= 1) — defaultVariantId só fica undefined pra
  // dado mock/legado que não passou por toStorefrontProduct().
  function buildCartInput() {
    return {
      productId: product.id,
      variantId: product.defaultVariantId ?? "",
      slug: product.slug,
      name: product.name,
      category: product.category,
      imageSrc: product.imageSrc,
      unitPrice: product.price,
      stock: Math.max(stock, 0),
      quantity,
    };
  }

  function handleAddToCart() {
    if (!isReady || stock < 1) {
      setFeedback("Produto indisponível no momento.");
      return;
    }
    if (!product.defaultVariantId) {
      setFeedback("Este produto está sem variante cadastrada e não pode ser comprado no momento.");
      return;
    }
    const added = addItem(buildCartInput());
    if (added) {
      setFeedback(
        `${quantity} ${quantity === 1 ? "unidade adicionada" : "unidades adicionadas"} ao carrinho.`,
      );
    } else {
      setFeedback("Limite de estoque atingido. Nenhuma unidade adicional foi incluída.");
    }
  }

  function handleBuyNow() {
    if (!isReady || stock < 1) return;
    if (!product.defaultVariantId) {
      setFeedback("Este produto está sem variante cadastrada e não pode ser comprado no momento.");
      return;
    }
    const added = addItem(buildCartInput());
    if (added) {
      router.push("/checkout");
    } else {
      setFeedback("Limite de estoque atingido. Nenhuma unidade adicional foi incluída.");
    }
  }

  if (isCourse) {
    return (
      <aside className={styles.panel} aria-labelledby="purchase-panel-title">
        <h2 id="purchase-panel-title" className={styles.price}>
          {formatPrice(product.price)}
        </h2>
        <p className={styles.stock}>Curso demonstrativo — preço ilustrativo</p>
        {product.seller ? (
          <p className={styles.seller}>
            Oferecido por <strong>{product.seller.name}</strong>
          </p>
        ) : null}

        <div className={styles.actions}>
          <a href="#programa-curso" className={styles.addCart}>
            Ver programa
          </a>
        </div>

        <p id={feedbackId} role="status" aria-live="polite" className={styles.feedback}>
          Inscrição e acesso às aulas ainda não estão integrados nesta etapa.
        </p>

        <ul className={styles.summaryList}>
          <li>
            <StarIcon className="h-4 w-4" filled />
            <span>Conteúdo demonstrativo da vitrine pública</span>
          </li>
          <li>
            <ClockIcon className="h-4 w-4" />
            <span>Sem frete físico — curso digital (ainda não integrado)</span>
          </li>
        </ul>

        {product.paymentSummary && product.paymentSummary.length > 0 ? (
          <div className={styles.payment}>
            <h3 className={styles.subheading}>Formas de pagamento</h3>
            <ul>
              {product.paymentSummary.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    );
  }

  return (
    <aside className={styles.panel} aria-labelledby="purchase-panel-title">
      <h2 id="purchase-panel-title" className={styles.price}>
        {formatPrice(product.price)}
      </h2>

      {onOffer && product.originalPrice != null && discountPercent != null ? (
        <p className={styles.discountRow}>
          <span className={styles.original}>{formatPrice(product.originalPrice)}</span>
          <span className={styles.badge}>-{discountPercent}%</span>
        </p>
      ) : null}

      <p className={styles.stock}>
        {stock > 0 ? `${stock} em estoque` : "Indisponível"}
      </p>

      {product.seller ? (
        <p className={styles.seller}>
          Vendido por <strong>{product.seller.name}</strong>
        </p>
      ) : null}

      <div className={styles.quantityBlock}>
        <label htmlFor={quantityId} className={styles.label}>
          Quantidade
        </label>
        <div className={styles.quantityControls}>
          <button
            type="button"
            className={styles.qtyBtn}
            onClick={decrease}
            disabled={quantity <= 1}
            aria-label="Diminuir quantidade"
          >
            <MinusIcon className="h-4 w-4" />
          </button>
          <input
            id={quantityId}
            className={styles.qtyInput}
            type="number"
            min={1}
            max={Math.max(stock, 1)}
            value={quantity}
            readOnly
          />
          <button
            type="button"
            className={styles.qtyBtn}
            onClick={increase}
            disabled={quantity >= stock || stock < 1}
            aria-label="Aumentar quantidade"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.addCart}
          onClick={handleAddToCart}
          disabled={!isReady || stock < 1}
        >
          <CartIcon className="h-4 w-4" />
          Adicionar ao carrinho
        </button>
        <button
          type="button"
          className={styles.buyNow}
          onClick={handleBuyNow}
          disabled={!isReady || stock < 1}
        >
          Comprar agora
        </button>
      </div>

      <p id={feedbackId} role="status" aria-live="polite" className={styles.feedback}>
        {feedback}
      </p>

      <div className={styles.shipping}>
        <label htmlFor={cepId} className={styles.label}>
          Calcular frete
        </label>
        <div className={styles.cepRow}>
          <input
            id={cepId}
            type="text"
            inputMode="numeric"
            placeholder="00000-000"
            value={cep}
            onChange={(event) => setCep(event.target.value)}
            className={styles.cepInput}
            aria-describedby="cep-help"
          />
          <button type="button" className={styles.cepBtn}>
            Calcular
          </button>
        </div>
        <p id="cep-help" className={styles.help}>
          Cálculo visual — integração de frete em etapa futura.
        </p>
      </div>

      <ul className={styles.summaryList}>
        <li>
          <TruckIcon className="h-4 w-4" />
          <span>Frete sob consulta por CEP</span>
        </li>
        <li>
          <ClockIcon className="h-4 w-4" />
          <span>Envio em até 2 dias úteis</span>
        </li>
        <li>
          <StarIcon className="h-4 w-4" filled />
          <span>Compra segura Instituto Potala</span>
        </li>
      </ul>

      {product.paymentSummary && product.paymentSummary.length > 0 ? (
        <div className={styles.payment}>
          <h3 className={styles.subheading}>Formas de pagamento</h3>
          <ul>
            {product.paymentSummary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
