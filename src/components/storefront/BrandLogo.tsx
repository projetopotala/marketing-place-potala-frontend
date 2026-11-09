import Image from "next/image";
import { BRAND } from "@/data/marketplace";

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
  variant?: "header" | "footer";
}

export function BrandLogo({
  className = "",
  priority = false,
  variant = "header",
}: BrandLogoProps) {
  if (variant === "footer") {
    return (
      <span className={`brand-logo brand-logo--footer inline-flex min-w-0 items-center gap-3 ${className}`}>
        <Image
          src={BRAND.logoSrc}
          alt=""
          width={56}
          height={56}
          className="brand-logo__mark h-12 w-12 shrink-0 md:h-14 md:w-14"
        />
        <span className="min-w-0 text-potala-gold">
          <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-potala-gold-light">
            Instituto
          </span>
          <span className="flex items-baseline gap-2">
            <span className="font-serif text-[1.55rem] font-semibold leading-none tracking-[0.02em] md:text-[1.7rem]">
              Potala
            </span>
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rotate-45 border border-potala-gold/70"
            />
          </span>
          <span className="mt-1 block text-[0.62rem] font-medium uppercase tracking-[0.36em] text-potala-gold/90">
            Marketplace
          </span>
        </span>
        <span className="sr-only">{BRAND.fullName}</span>
      </span>
    );
  }

  return (
    <span className={`brand-logo inline-flex min-w-0 items-center gap-3 ${className}`}>
      <Image
        src={BRAND.logoSrc}
        alt=""
        width={72}
        height={72}
        className="brand-logo__mark h-14 w-14 shrink-0 md:h-16 md:w-16 lg:h-[4.25rem] lg:w-[4.25rem]"
        priority={priority}
      />
      <span className="min-w-0 text-potala-gold">
        <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.34em] text-potala-gold-light md:text-[0.68rem]">
          Instituto
        </span>
        <span className="flex items-baseline gap-2">
          <span className="font-serif text-[1.7rem] font-semibold leading-none tracking-[0.02em] md:text-[1.9rem] lg:text-[2.05rem]">
            Potala
          </span>
          <span
            aria-hidden="true"
            className="hidden h-3 w-3 rotate-45 border border-potala-gold/70 sm:inline-block"
          />
        </span>
        <span className="mt-1 block text-[0.68rem] font-medium uppercase tracking-[0.42em] text-potala-gold/90 md:text-[0.72rem]">
          Marketplace
        </span>
      </span>
      <span className="sr-only">{BRAND.fullName}</span>
    </span>
  );
}
