"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types/marketplace";
import { textIncludes } from "@/lib/normalizeText";
import styles from "./sellerStore.module.css";

type SortKey = "featured" | "price-asc" | "price-desc" | "rating";

interface SellerStorefrontViewProps {
  sellerName: string;
  sellerDescription: string;
  sellerRating: number;
  /** 0 quando a loja ainda não tem nenhuma avaliação real — distingue "sem avaliação" de "nota baixa". */
  sellerReviewCount: number;
  coverImageSrc: string;
  categories: string[];
  products: Product[];
  featured: Product[];
}

const PAGE_SIZE = 8;

export function SellerStorefrontView({
  sellerName,
  sellerDescription,
  sellerRating,
  sellerReviewCount,
  coverImageSrc,
  categories,
  products,
  featured,
}: SellerStorefrontViewProps) {
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("featured");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = products.filter((product) => {
      const matchesCategory =
        category === "all" || textIncludes(product.category, category);
      const matchesQuery =
        textIncludes(product.name, query) ||
        textIncludes(product.category, query) ||
        textIncludes(product.description ?? "", query);
      return matchesCategory && matchesQuery;
    });

    list = [...list].sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "rating") return b.rating - a.rating;
      return Number(b.featured) - Number(a.featured);
    });

    return list;
  }, [category, products, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className={styles.page}>
      <section className={styles.cover} aria-label={`Capa da loja ${sellerName}`}>
        <Image
          src={coverImageSrc}
          alt=""
          fill
          sizes="100vw"
          className={styles.coverImage}
          priority
        />
        <div className={styles.coverOverlay}>
          <p className={styles.eyebrow}>Loja parceira</p>
          <h1 className={styles.title}>{sellerName}</h1>
          <p className={styles.lead}>{sellerDescription}</p>
          <p className={styles.rating}>
            {sellerReviewCount > 0
              ? `Avaliação ${sellerRating.toFixed(1)} (${sellerReviewCount})`
              : "Sem avaliações ainda"}{" "}
            · {products.length} produtos
          </p>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className={styles.section} aria-labelledby="seller-featured">
          <h2 id="seller-featured" className={styles.sectionTitle}>
            Destaques
          </h2>
          <div className={styles.grid}>
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="seller-catalog">
        <div className={styles.toolbar}>
          <h2 id="seller-catalog" className={styles.sectionTitle}>
            Catálogo
          </h2>
          <div className={styles.filters}>
            <div>
              <label htmlFor="seller-store-search">Buscar</label>
              <input
                id="seller-store-search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div>
              <label htmlFor="seller-store-category">Categoria</label>
              <select
                id="seller-store-category"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setPage(0);
                }}
              >
                <option value="all">Todas</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="seller-store-sort">Ordenar</label>
              <select
                id="seller-store-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
              >
                <option value="featured">Destaques</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="rating">Avaliação</option>
              </select>
            </div>
          </div>
        </div>

        {pageItems.length === 0 ? (
          <p>Nenhum produto encontrado nesta loja.</p>
        ) : (
          <div className={styles.grid}>
            {pageItems.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <div className={styles.pager}>
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            Anterior
          </button>
          <span>
            Página {page + 1} de {pageCount}
          </span>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() =>
              setPage((current) => Math.min(pageCount - 1, current + 1))
            }
          >
            Próxima
          </button>
        </div>
      </section>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <article className={styles.card}>
      <Link href={`/produto/${product.slug}`} className={styles.cardLink}>
        <div className={styles.cardMedia}>
          <Image
            src={product.imageSrc}
            alt={product.imageAlt}
            fill
            sizes="(max-width: 768px) 50vw, 240px"
          />
        </div>
        <h3>{product.name}</h3>
        <p>{product.category}</p>
        <p className={styles.price}>
          {product.price.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        </p>
      </Link>
    </article>
  );
}
