import { apiFetch } from "./client";

/**
 * New this session (vitrine pública da loja, /vendedor/[slug]). Client do
 * único endpoint público de sellers-service — mesmo padrão de degradação
 * silenciosa de `catalog-public.ts` (sem sessão, sem guard, chamado por um
 * visitante anônimo).
 */
export interface PublicSeller {
  id: string;
  tradeName: string;
  slug: string;
  description: string | null;
  ratingAverage: number;
}

/**
 * GET /public/sellers/:slug — retorna `null` (não lança) em qualquer falha,
 * incluindo 404 — uma loja PENDING/REJECTED/SUSPENDED devolve o mesmo 404
 * de um slug inexistente (ver sellers.service.ts), então a página sempre
 * trata "não encontrada" e "backend indisponível" da mesma forma segura:
 * `notFound()`, nunca um 500.
 */
export async function getPublicSellerBySlug(slug: string): Promise<PublicSeller | null> {
  try {
    return await apiFetch<PublicSeller>(`/public/sellers/${encodeURIComponent(slug)}`);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status !== 404) {
      console.error(`[sellers-public] getPublicSellerBySlug(${slug}) failed, degrading to not-found:`, err);
    }
    return null;
  }
}
