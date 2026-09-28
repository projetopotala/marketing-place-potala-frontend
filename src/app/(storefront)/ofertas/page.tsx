import { notFound } from "next/navigation";

/**
 * Removido do ar nesta sessão (vitrine pública real, ver
 * status-migracao-microservicos.md) — decisão do Arthur via
 * AskUserQuestion: o backend não tem nenhum campo de preço
 * promocional/desconto no produto (cupom, que existe, é outra coisa —
 * código aplicado no checkout, não um preço "de oferta" na vitrine), então
 * a página antiga (`originalPrice` inventado no mock) mostrava dado que
 * não existe em lugar nenhum do sistema real. Sem link nenhum apontando
 * pra cá (removido de `NAV_CATEGORIES` em `data/marketplace.ts`) — quem
 * chegar aqui por um link/bookmark antigo recebe um 404 normal, não uma
 * seção vazia sem explicação. Revisitar quando existir uma feature real
 * de preço promocional (fora do roadmap atual).
 */
export default function OfertasPage() {
  notFound();
}
