import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/storefront/icons";
import { FadeIn } from "@/components/ui/motion/FadeIn";

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-title"
      className="potala-hero relative isolate overflow-hidden border-b border-potala-border"
    >
      <Image
        src="/images/potala/hero-bg-v2.png"
        alt=""
        fill
        sizes="100vw"
        preload
        className="object-cover object-[center_54%] md:object-[center_54%]"
      />
      <div
        className="potala-hero-overlay-mobile absolute inset-0 md:hidden"
        aria-hidden="true"
      />
      <div
        className="potala-hero-overlay absolute inset-0 hidden md:block"
        aria-hidden="true"
      />

      <div className="potala-wide-container relative flex min-h-[26rem] items-center py-8 md:min-h-[26.25rem] md:py-0">
        <FadeIn className="w-full max-w-[42.5rem] lg:max-w-[44rem]">
          <h1
            id="hero-title"
            className="font-serif text-[2.5rem] font-medium leading-[1.04] tracking-tight text-potala-text sm:text-[2.75rem] md:text-[clamp(3.25rem,3.45vw,3.75rem)]"
          >
            <span className="block">Produtos que elevam</span>
            <span className="block">
              a <span className="text-potala-gold">consciência</span> e transformam
            </span>
            <span className="block">sua jornada</span>
          </h1>
          <p className="mt-6 max-w-[36.25rem] text-[1.0625rem] leading-relaxed text-potala-cream md:mt-[1.5rem] md:text-[1.125rem]">
            Uma seleção consciente de produtos para seu bem-estar, aprendizado,
            cura e expansão espiritual.
          </p>
          <div className="mt-8 flex flex-col gap-[1.15rem] sm:flex-row">
            <Link
              href="/catalogo"
              className="potala-btn potala-btn-primary min-h-12 px-[1.625rem]"
            >
              Explorar produtos
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/#categorias"
              className="potala-btn potala-btn-secondary min-h-12 px-[1.625rem]"
            >
              Conhecer categorias
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
