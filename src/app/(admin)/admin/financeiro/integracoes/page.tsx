import { notFound } from "next/navigation";

/**
 * Removido do menu do admin nesta sessão (29/09 — ver
 * status-migracao-microservicos.md). A tela mostrava gateways de
 * pagamento (Mercado Pago, Stripe etc.) inteiramente inventados no mock
 * (db.gateways, "conectado"/"saudável" sem nenhuma integração real por
 * trás) — depende diretamente da decisão de gateway de pagamento (Fase
 * C), que o Arthur decidiu deixar pro final. A tela antiga
 * (IntegrationsView.tsx, ainda no repositório mas inacessível a partir
 * do menu) fica pra ser revisitada quando essa decisão for tomada. Sem
 * link nenhum apontando pra cá (removido de ADMIN_NAV em
 * data/admin.ts) — quem chegar aqui por um link/bookmark antigo recebe
 * um 404 normal.
 */
export default function AdminIntegrationsPage() {
  notFound();
}
