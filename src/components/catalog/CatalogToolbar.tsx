"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";
import {
  buildCatalogSearchParams,
  type ProductSortOrder,
} from "@/features/catalog/selectors";

export interface CatalogToolbarCategory {
  id: string;
  name: string;
}

interface CatalogToolbarProps {
  /** When set, category is fixed by the route (not a filter control). */
  lockedCategoryId?: string;
  /** When set, collection is fixed by the route/query context. */
  lockedCollection?: string;
  showCategoryFilter?: boolean;
  resultCount: number;
  currentQuery: string;
  currentOrder: ProductSortOrder;
  currentCategoryId?: string;
  /**
   * Real catalog-service categories (GET /public/categories), threaded in
   * by the page — replaces the old hardcoded CATALOG_CATEGORIES import so
   * this dropdown always matches whatever the admin has actually created.
   */
  categories: CatalogToolbarCategory[];
}

const ORDER_OPTIONS: { value: ProductSortOrder; label: string }[] = [
  { value: "relevancia", label: "Relevância editorial" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "nome", label: "Nome (A–Z)" },
];

export function CatalogToolbar({
  lockedCategoryId,
  lockedCollection,
  showCategoryFilter = true,
  resultCount,
  currentQuery,
  currentOrder,
  currentCategoryId,
  categories,
}: CatalogToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const searchId = useId();
  const orderId = useId();
  const categoryId = useId();

  function navigate(next: {
    q?: string;
    ordem?: ProductSortOrder;
    categoria?: string;
    colecao?: string;
  }) {
    const params = buildCatalogSearchParams({
      q: next.q ?? currentQuery,
      ordem: next.ordem ?? currentOrder,
      categoria:
        lockedCategoryId ??
        (showCategoryFilter
          ? (next.categoria ?? currentCategoryId)
          : undefined),
      colecao: lockedCollection ?? next.colecao,
    });

    // Locked category pages keep filters on the same path without categoria param.
    if (lockedCategoryId) {
      params.delete("categoria");
    }
    if (lockedCollection) {
      params.set("colecao", lockedCollection);
    }

    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function clearFilters() {
    const params = new URLSearchParams();
    if (lockedCollection) params.set("colecao", lockedCollection);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  const hasActiveFilters =
    Boolean(currentQuery) ||
    currentOrder !== "relevancia" ||
    (showCategoryFilter && Boolean(currentCategoryId) && !lockedCategoryId);

  // Preserve unknown params that we don't manage (defensive).
  void searchParams;

  return (
    <div className="catalog-toolbar flex flex-col gap-4 border border-potala-border bg-potala-panel/60 p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-potala-muted" aria-live="polite">
          {resultCount === 0
            ? "Nenhum produto encontrado"
            : `${resultCount} ${resultCount === 1 ? "produto" : "produtos"}`}
          {pending ? " · atualizando…" : null}
        </p>
        {hasActiveFilters ? (
          <button
            type="button"
            className="min-h-11 rounded-[0.375rem] border border-potala-gold/40 px-3 text-sm text-potala-gold transition hover:bg-potala-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-potala-gold"
            onClick={clearFilters}
          >
            Limpar filtros
          </button>
        ) : null}
      </div>

      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          navigate({
            q: String(form.get("q") ?? ""),
            ordem: String(form.get("ordem") ?? "relevancia") as ProductSortOrder,
            categoria: String(form.get("categoria") ?? "") || undefined,
          });
        }}
      >
        <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <label htmlFor={searchId} className="text-xs font-semibold uppercase tracking-wide text-potala-gold">
            Buscar
          </label>
          <input
            id={searchId}
            name="q"
            type="search"
            defaultValue={currentQuery}
            placeholder="Nome, categoria ou descrição…"
            className="potala-input min-h-11 w-full"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={orderId} className="text-xs font-semibold uppercase tracking-wide text-potala-gold">
            Ordenar
          </label>
          <select
            id={orderId}
            name="ordem"
            defaultValue={currentOrder}
            className="potala-input min-h-11 w-full"
            onChange={(event) => {
              navigate({
                ordem: event.target.value as ProductSortOrder,
              });
            }}
          >
            {ORDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {showCategoryFilter && !lockedCategoryId ? (
          <div className="flex min-w-0 flex-col gap-1.5">
            <label
              htmlFor={categoryId}
              className="text-xs font-semibold uppercase tracking-wide text-potala-gold"
            >
              Categoria
            </label>
            <select
              id={categoryId}
              name="categoria"
              defaultValue={currentCategoryId ?? ""}
              className="potala-input min-h-11 w-full"
              onChange={(event) => {
                navigate({
                  categoria: event.target.value || undefined,
                });
              }}
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex items-end sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            className="potala-btn potala-btn-primary min-h-11 px-5"
          >
            Aplicar busca
          </button>
        </div>
      </form>

      {currentQuery ? (
        <p className="text-sm text-potala-cream/80">
          Resultados para “{currentQuery}”.{" "}
          <Link
            href={
              lockedCategoryId
                ? `/categoria/${lockedCategoryId}`
                : lockedCollection
                  ? `/catalogo?colecao=${lockedCollection}`
                  : "/catalogo"
            }
            className="text-potala-gold underline-offset-2 hover:underline"
          >
            Limpar busca
          </Link>
        </p>
      ) : null}
    </div>
  );
}
