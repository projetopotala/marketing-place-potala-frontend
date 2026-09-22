import { DiscoverySections } from "@/components/storefront/DiscoverySections";
import { FeaturedCategories } from "@/components/storefront/FeaturedCategories";
import { FeaturedProducts } from "@/components/storefront/FeaturedProducts";
import { HeroSection } from "@/components/storefront/HeroSection";
import { NewsletterSection } from "@/components/storefront/NewsletterSection";
import { PhilosophySection } from "@/components/storefront/PhilosophySection";
import { TestimonialsSection } from "@/components/storefront/TestimonialsSection";

/**
 * FeaturedCategories/FeaturedProducts fetch from potala-api-gateway
 * (catalog-service) at render time. Left as a default static page, Next
 * tries to prerender this at *build* time — and on Vercel that means the
 * build itself depends on the Render backend being awake and fast enough
 * to answer inside the build's single fetch attempt, which fails (502)
 * whenever the free-tier service is cold. Forcing dynamic rendering makes
 * this page render per-request instead, same as every other page here
 * that talks to the backend (catalogo, novidades, ofertas, categoria all
 * end up dynamic via searchParams already).
 */
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <HeroSection />
      <FeaturedCategories />
      <FeaturedProducts />
      <DiscoverySections />
      <PhilosophySection />
      <TestimonialsSection />
      <NewsletterSection />
    </>
  );
}
