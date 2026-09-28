import { notFound } from "next/navigation";

/**
 * Removido do menu do admin nesta sessão (29/09 — ver
 * status-migracao-microservicos.md). A tela gerenciava repasses de
 * dinheiro pro vendedor (criar repasse, marcar como pago) inteiramente
 * no mock (db.payouts) — não existe nenhum model de payout em nenhum
 * backend, e a feature depende da mesma decisão de gateway de pagamento
 * (Fase C) que o Arthur decidiu deixar pro final. A tela antiga
 * (PayoutsView.tsx, ainda no repositório mas inacessível a partir do
 * menu) fica pra ser revisitada nessa hora. Sem link nenhum apontando
 * pra cá (removido de ADMIN_NAV em data/admin.ts) — quem chegar aqui por
 * um link/bookmark antigo recebe um 404 normal.
 */
export default function AdminPayoutsPage() {
  notFound();
}
