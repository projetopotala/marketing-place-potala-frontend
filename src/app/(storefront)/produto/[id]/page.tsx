import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/commerce/ProductGallery";
import { ProductInformation } from "@/components/commerce/ProductInformation";
import { ProductPurchasePanel } from "@/components/commerce/ProductPurchasePanel";
import { ProductReviews } from "@/components/commerce/ProductReviews";
import { RelatedProducts } from "@/components/commerce/RelatedProducts";
import {
  getPublicProduct,
  listPublicProducts,
  toStorefrontProduct,
} from "@/lib/api/catalog-public";
import styles from "./page.module.css";

/**
 * Rewritten this session (Fase 1 do plano até 05/10) — real produto via
 * GET /public/products/:id (catalog-service). Route param renamed from
 * [slug] to [id]: Product.slug only unique per vendedor
 * (`@@unique([sellerId, slug])`), não globalmente — ver o comentário em
 * catalog-public.ts's toStorefrontProduct. No `generateStaticParams`:
 * produtos são dinâmicos agora (criados/publicados pelo vendedor a
 * qualquer momento), não uma lista fixa no build.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getPublicProduct(id);

  if (!product) {
    return { title: "Produto não encontrado | Instituto Potala Marketplace" };
  }

  return {
    title: `${product.title} | Instituto Potala Marketplace`,
    description: product.description || product.title,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const apiProduct = await getPublicProduct(id);

  if (!apiProduct) {
    notFound();
  }

  const product = toStorefrontProduct(apiProduct);
  const images = product.images ?? [];

  const relatedPage = await listPublicProducts({
    categoryId: apiProduct.category.id,
    limit: 5,
  });
  const related = relatedPage.items
    .filter((p) => p.id !== apiProduct.id)
    .slice(0, 4)
    .map(toStorefrontProduct);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Início</Link>
            </li>
            <li>
              <Link href={`/categoria/${apiProduct.category.slug}`}>
                {product.category}
              </Link>
            </li>
            <li aria-current="page">{product.name}</li>
          </ol>
        </nav>

        <div className={styles.topGrid}>
          <div className={styles.galleryCol}>
            <ProductGallery images={images} productName={product.name} />
          </div>

          <div className={styles.infoCol}>
            <ProductInformation product={product} />
          </div>

          <div className={styles.panelCol}>
            <ProductPurchasePanel product={product} />
          </div>
        </div>

        <div className={styles.details}>
          {product.longDescription || product.characteristics?.length ? (
            <section
              className={styles.block}
              id={product.modality === "course" || product.action === "details" ? "programa-curso" : undefined}
              aria-labelledby="product-description-title"
            >
              <h2 id="product-description-title" className={styles.blockTitle}>
                {product.modality === "course" || product.action === "details"
                  ? "Programa"
                  : "Descrição"}
              </h2>
              {product.longDescription ? (
                <p className={styles.copy}>{product.longDescription}</p>
              ) : product.description ? (
                <p className={styles.copy}>{product.description}</p>
              ) : null}
            </section>
          ) : null}

          {product.characteristics && product.characteristics.length > 0 ? (
            <section
              className={styles.block}
              aria-labelledby="product-characteristics-title"
            >
              <h2
                id="product-characteristics-title"
                className={styles.blockTitle}
              >
                {product.modality === "course" || product.action === "details"
                  ? "Detalhes do programa"
                  : "Características"}
              </h2>
              <dl className={styles.specs}>
                {product.characteristics.map((item) => (
                  <div key={item.label} className={styles.specRow}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {product.shippingSummary &&
          product.shippingSummary.length > 0 &&
          product.modality !== "course" &&
          product.action !== "details" ? (
            <section
              className={styles.block}
              aria-labelledby="product-shipping-title"
            >
              <h2 id="product-shipping-title" className={styles.blockTitle}>
                Informações de entrega
              </h2>
              <ul className={styles.bullets}>
                {product.shippingSummary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <ProductReviews product={product} />
        </div>

        <RelatedProducts products={related} />
      </div>
    </div>
  );
}
