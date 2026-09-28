"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { catalogHref } from "@/features/catalog/selectors";
import { textIncludes } from "@/lib/normalizeText";
import { SearchIcon } from "@/components/storefront/icons";
import {
  listPublicCategories,
  listPublicProducts,
  type PublicCategory,
} from "@/lib/api/catalog-public";

interface StoreSearchHit {
  id: string;
  label: string;
  meta: string;
  href: string;
  group: "Produtos" | "Categorias" | "Ações";
}

/**
 * Rewritten this session (vitrine pública real, ver
 * status-migracao-microservicos.md) — antes filtrava só o array mock
 * `PRODUCTS`/`FEATURED_CATEGORIES` (`data/marketplace.ts`) em memória, sem
 * nenhuma chamada de rede. Categorias reais são poucas e mudam raramente
 * (buscadas uma vez ao abrir a busca, filtradas no cliente); produtos
 * reais podem ser muitos, então a busca por título já usa o filtro `q` do
 * próprio backend (`GET /public/products?q=`, mesmo endpoint que
 * `/catalogo` já usa) em vez de carregar tudo pra filtrar depois — só que
 * agora com debounce, pra não disparar uma requisição a cada tecla.
 */
const SEARCH_DEBOUNCE_MS = 250;

export function StorefrontSearch() {
  const router = useRouter();
  const searchId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [productHits, setProductHits] = useState<StoreSearchHit[]>([]);
  const requestIdRef = useRef(0);

  // Categorias reais buscadas uma vez, ao abrir a busca pela primeira vez —
  // não precisam ser re-buscadas a cada tecla, filtro é local (textIncludes).
  useEffect(() => {
    if (!open || categories.length > 0) return;
    listPublicCategories().then(setCategories);
  }, [open, categories.length]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setProductHits([]);
      return;
    }

    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      listPublicProducts({ q, limit: 8 }).then((page) => {
        if (requestIdRef.current !== requestId) return; // resposta obsoleta, query já mudou
        setProductHits(
          page.items.map((product) => ({
            id: product.id,
            label: product.title,
            meta: product.category.name,
            href: `/produto/${product.id}`,
            group: "Produtos" as const,
          })),
        );
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo<StoreSearchHit[]>(() => {
    const q = query.trim();
    if (!q) return [];

    const categoryHits: StoreSearchHit[] = categories
      .filter((category) => textIncludes(category.name, q))
      .slice(0, 5)
      .map((category) => ({
        id: category.id,
        label: category.name,
        meta: "Categoria",
        href: `/categoria/${category.slug}`,
        group: "Categorias" as const,
      }));

    const actionHits: StoreSearchHit[] = [
      {
        id: "see-all-results",
        label: `Ver todos os resultados para “${q}”`,
        meta: "Catálogo",
        href: catalogHref({ q }),
        group: "Ações",
      },
    ];

    return [...productHits, ...categoryHits, ...actionHits];
  }, [categories, productHits, query]);

  const hasQuery = query.trim().length > 0;
  const productResultHits = results.filter((item) => item.group === "Produtos");
  const categoryResultHits = results.filter((item) => item.group === "Categorias");
  const actionResultHits = results.filter((item) => item.group === "Ações");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        const typing =
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          target?.isContentEditable;
        if (typing && !open) return;
        event.preventDefault();
        setOpen((current) => !current);
        if (open) setQuery("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  function openResult(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <div className="relative w-full">
        <button
          ref={triggerRef}
          id={searchId}
          type="button"
          className="potala-input flex w-full items-center pr-12 text-left text-potala-muted"
          aria-label="Abrir busca da loja"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
        >
          <span className="truncate">Buscar produtos, livros, incensos...</span>
        </button>
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-potala-gold">
          <SearchIcon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Busca da loja"
        description="Busque produtos, cursos e categorias do Instituto Potala."
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar produtos, livros, incensos..."
            aria-label="Termo da busca da loja"
          />
          <CommandList>
            <CommandEmpty>
              {hasQuery
                ? `Nenhum resultado para “${query.trim()}”.`
                : "Digite para buscar produtos, cursos e categorias."}
            </CommandEmpty>

            {productResultHits.length > 0 ? (
              <CommandGroup heading="Produtos">
                {productResultHits.map((item) => (
                  <CommandItem
                    key={`product-${item.id}`}
                    value={`product:${item.id}:${item.label}`}
                    onSelect={() => openResult(item.href)}
                  >
                    <Search className="size-4 opacity-60" aria-hidden="true" />
                    <span className="flex min-w-0 flex-col">
                      <span>{item.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.meta}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {categoryResultHits.length > 0 ? (
              <CommandGroup heading="Categorias">
                {categoryResultHits.map((item) => (
                  <CommandItem
                    key={`category-${item.id}`}
                    value={`category:${item.id}:${item.label}`}
                    onSelect={() => openResult(item.href)}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span>{item.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.meta}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {hasQuery && actionResultHits.length > 0 ? (
              <CommandGroup heading="Catálogo">
                {actionResultHits.map((item) => (
                  <CommandItem
                    key={`action-${item.id}`}
                    value={`action:${item.id}:${item.label}`}
                    onSelect={() => openResult(item.href)}
                  >
                    <span>{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
