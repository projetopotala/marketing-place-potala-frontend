"use client";

import { useEffect } from "react";

/**
 * Safety net for the storefront route group. Most of the "backend is
 * cold/unreachable" cases are already handled upstream now (see
 * lib/api/catalog-public.ts — listPublicCategories/listPublicProducts/
 * getPublicProduct degrade to an empty result instead of throwing), so in
 * practice a shopper should rarely hit this. This exists for whatever is
 * left uncovered: header/footer (AnnouncementBar, MarketplaceHeader,
 * MarketplaceFooter) still render from the layout above this boundary —
 * only the page content is replaced — so navigation stays usable even when
 * one page's data genuinely can't be recovered.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[storefront/error.tsx] Unhandled error rendering a storefront page:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-potala-bg px-6 py-16 text-center">
      <h1 className="font-serif text-2xl font-semibold text-potala-cream md:text-3xl">
        Não conseguimos carregar esta página agora
      </h1>
      <p className="max-w-md text-sm text-potala-cream/80">
        Pode ser algo temporário no nosso sistema. Tente novamente em alguns
        instantes — o resto do site continua disponível pelo menu acima.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-potala-gold/45 px-6 text-sm text-potala-gold transition hover:bg-potala-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-potala-gold-light"
      >
        Tentar novamente
      </button>
    </div>
  );
}
