"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AccountChrome } from "@/components/account/AccountChrome";
import { useAccountData } from "@/features/account/AccountDataContext";
import { getPublicProduct, type PublicProduct } from "@/lib/api/catalog-public";
import { formatPrice } from "@/data/marketplace";

const FALLBACK_IMAGE_SRC = "/images/potala/logo-mark.png";

/**
 * Real via GET /orders/favorites (orders-service, novo nesta sessão) +
 * GET /public/products/:id (catalog-service, já existia) -- substitui o
 * mock antigo (`useAccountData().db.favorites`, localStorage).
 *
 * O favorito em si (lista de productIds) vem de AccountDataContext, que
 * já busca `/orders/favorites` uma vez pro app inteiro (o mesmo estado
 * alimenta o coração em ProductCard em toda a vitrine). Esta tela só
 * adiciona a resolução de cada produto (nome/imagem/preço atuais) via
 * catalog-service, uma chamada por item em paralelo -- lista de desejos
 * costuma ser pequena (dezenas, não milhares), então N chamadas em
 * paralelo é aceitável aqui; não existe endpoint de busca em lote no
 * catalog-service ainda (mesma simplificação já aceita para nota/produto
 * em avaliações). Um produto excluído/desativado depois de favoritado
 * simplesmente não aparece na lista (getPublicProduct retorna null pra
 * DRAFT/INACTIVE/inexistente) -- o favorito continua existindo no banco,
 * só não é exibido, mesmo espírito de "não finge dado" do resto do
 * projeto.
 */
export default function AccountFavoritesPage() {
  const { favorites, favoritesLoading, toggleFavorite } = useAccountData();
  const [products, setProducts] = useState<Record<string, PublicProduct | null> | null>(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    if (favoritesLoading) return;

    let cancelled = false;
    // Promise.resolve().then, mesmo padrão de AccountDataContext.tsx --
    // evita setState síncrono direto no corpo do efeito
    // (react-hooks/set-state-in-effect), inclusive no branch "sem
    // favoritos" abaixo.
    Promise.resolve().then(() => {
      if (cancelled) return;
      const ids = (favorites ?? []).map((item) => item.productId);
      if (ids.length === 0) {
        setProducts({});
        setResolving(false);
        return;
      }

      setResolving(true);
      Promise.all(ids.map((id) => getPublicProduct(id).then((product) => [id, product] as const)))
        .then((entries) => {
          if (cancelled) return;
          setProducts(Object.fromEntries(entries));
        })
        .finally(() => {
          if (!cancelled) setResolving(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [favorites, favoritesLoading]);

  const isLoading = favoritesLoading || resolving || !products;
  const items = (favorites ?? [])
    .map((favorite) => ({ favorite, product: products?.[favorite.productId] ?? null }))
    .filter((entry): entry is { favorite: NonNullable<typeof entry.favorite>; product: PublicProduct } =>
      entry.product !== null,
    );

  return (
    <AccountChrome
      title="Favoritos"
      lead="Lista de desejos sincronizada com os cards do catálogo."
      breadcrumbCurrent="Favoritos"
    >
      {isLoading ? (
        <p role="status">Carregando…</p>
      ) : items.length === 0 ? (
        <p>Sua lista de desejos está vazia.</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          }}
        >
          {items.map(({ favorite, product }) => {
            const imageSrc = product.images[0]?.url ?? FALLBACK_IMAGE_SRC;
            return (
              <li
                key={favorite.productId}
                style={{
                  border: "1px solid var(--potala-border)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <Link href={`/produto/${product.id}`}>
                  <div style={{ position: "relative", aspectRatio: "1" }}>
                    <Image
                      src={imageSrc}
                      alt={product.title}
                      fill
                      sizes="180px"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <p style={{ padding: "0 8px" }}>{product.title}</p>
                  <p style={{ padding: "0 8px 8px" }}>
                    {formatPrice(product.priceCents / 100)}
                  </p>
                </Link>
                <button
                  type="button"
                  style={{ minHeight: 44, width: "100%" }}
                  onClick={() =>
                    toggleFavorite({
                      productId: product.id,
                      slug: product.id,
                      name: product.title,
                      imageSrc,
                      price: product.priceCents / 100,
                    })
                  }
                >
                  Remover
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AccountChrome>
  );
}
