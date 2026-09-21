import { CategoryCard } from "@/components/storefront/CategoryCard";
import { listPublicCategories } from "@/lib/api/catalog-public";
import type { CategoryHighlight } from "@/types/marketplace";

/**
 * Rewritten this session (Fase 1 do plano até 05/10) — categorias reais
 * (GET /public/categories) em vez da lista editorial fixa de 7
 * categorias. Continua async Server Component (dado público, sem sessão).
 *
 * As imagens de categoria feitas sob medida (public/images/potala/
 * category-*.png) não têm nenhuma contrapartida no backend — não existe
 * campo de imagem em Category. Reaproveitadas por nome quando uma
 * categoria real bate com uma dessas sete (ex.: "Livros", "Cristais"),
 * com uma imagem genérica de fallback pras demais (categorias novas que o
 * Arthur ainda vier a criar no admin).
 */
const CATEGORY_IMAGE_BY_NAME: Record<string, { src: string; alt: string }> = {
  cursos: { src: "/images/potala/category-cursos-final.png", alt: "Categoria Cursos" },
  terapias: { src: "/images/potala/category-terapias-final.png", alt: "Categoria Terapias" },
  livros: { src: "/images/potala/category-livros-final.png", alt: "Categoria Livros" },
  incensos: { src: "/images/potala/category-incensos-final.png", alt: "Categoria Incensos" },
  cristais: { src: "/images/potala/category-cristais-final.png", alt: "Categoria Cristais" },
  acessorios: { src: "/images/potala/category-acessorios-final.png", alt: "Categoria Acessórios" },
  meditacao: { src: "/images/potala/category-meditacao-final.png", alt: "Categoria Meditação" },
};
const FALLBACK_CATEGORY_IMAGE = {
  src: "/images/potala/hero-bg-v2.png",
  alt: "Categoria do Instituto Potala",
};

function normalizeKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function FeaturedCategories() {
  const categories = await listPublicCategories();

  if (categories.length === 0) {
    return null;
  }

  const highlights: CategoryHighlight[] = categories.slice(0, 8).map((category) => {
    const image = CATEGORY_IMAGE_BY_NAME[normalizeKey(category.name)] ?? FALLBACK_CATEGORY_IMAGE;
    return {
      id: category.id,
      name: category.name,
      href: `/categoria/${category.slug}`,
      imageSrc: image.src,
      imageAlt: image.alt,
    };
  });

  return (
    <section
      id="categorias"
      aria-labelledby="featured-categories-heading"
      className="scroll-mt-28 border-b-4 border-potala-bg bg-potala-cream py-5 md:py-6"
    >
      <div className="featured-categories-container">
        <div className="mb-5 flex items-center justify-center gap-3 md:mb-[1.35rem]">
          <span
            aria-hidden="true"
            className="category-heading-ornament"
          />
          <h2
            id="featured-categories-heading"
            className="font-serif text-[1.375rem] font-semibold leading-none text-potala-bg md:text-[1.55rem]"
          >
            Categorias em destaque
          </h2>
          <span
            aria-hidden="true"
            className="category-heading-ornament category-heading-ornament--reverse"
          />
        </div>

        <div className="featured-categories-grid">
          {highlights.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </div>
    </section>
  );
}
