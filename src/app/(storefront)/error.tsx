"use client";

import { useEffect } from "react";

/**
 * Safety net for the storefront route group. The public catalog retries a
 * transient gateway failure once and then lands here rather than claiming
 * that an unavailable backend is an empty catalog. Header and footer remain
 * usable, so shoppers can navigate or retry without a false empty state.
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
