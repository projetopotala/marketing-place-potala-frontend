"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { catalogHref } from "@/features/catalog/selectors";
import { SearchIcon } from "@/components/storefront/icons";

/**
 * Hotfix de produção (05/10): a barra do header deixou de abrir um
 * modal/overlay por cima da página (CommandDialog + cmdk, com backdrop,
 * blur e um segundo campo dentro do diálogo) só pra digitar o termo —
 * comportamento padrão de marketplace é a própria barra ser o campo real.
 *
 * Reaproveita EXATAMENTE a mesma rota/contrato que a versão anterior já
 * usava pro item "Ver todos os resultados para…" dentro do modal:
 * catalogHref({ q }) -> "/catalogo?q=..." (features/catalog/selectors.ts,
 * intocado), consumida por CatalogListing/CatalogToolbar (intocados). Um
 * único <form onSubmit> cobre Enter (submit nativo do input) e o clique na
 * lupa (<button type="submit">) pelo mesmo caminho — nunca os dois
 * disparando a navegação em duplicidade.
 *
 * As sugestões em tempo real (produtos/categorias buscados a cada tecla,
 * via listPublicProducts/listPublicCategories) saíram junto com o modal:
 * elas só existiam para popular aquele dropdown. Fora de escopo deste
 * hotfix trazê-las de volta como um painel de autocomplete sem
 * overlay/backdrop — combinado com o Arthur como corte deliberado pra
 * manter a mudança mínima antes da apresentação de hoje.
 */
export function StorefrontSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(catalogHref({ q: query }));
  }

  return (
    <form className="relative w-full" onSubmit={handleSubmit}>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar produtos, livros, incensos..."
        aria-label="Buscar produtos, livros, incensos na loja"
        className="potala-input w-full pr-12"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute inset-y-0 right-4 flex items-center text-potala-gold"
      >
        <SearchIcon className="h-5 w-5" aria-hidden="true" />
      </button>
    </form>
  );
}
