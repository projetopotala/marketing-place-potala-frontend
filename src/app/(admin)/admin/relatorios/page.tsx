import { notFound } from "next/navigation";

/**
 * Removido do menu do admin nesta sessão (29/09 — ver
 * status-migracao-microservicos.md). A tela oferecia 8 tipos de
 * relatório (vendas, pedidos, vendedores, produtos, clientes, entregas,
 * financeiro, conteúdos), todos calculados em cima do banco demo local
 * (useAdminData) — nenhum serviço do backend tem endpoint de agregação
 * hoje (só paginação por cursor), então cada um exigiria trabalho novo
 * de backend em um ou mais dos 4 serviços. Não fazia sentido investir
 * nisso a poucos dias da entrega de 05/10. A tela antiga
 * (ReportsView.tsx, ainda no repositório mas inacessível a partir do
 * menu) fica como referência caso o Arthur queira priorizar 1-2
 * relatórios reais depois. Sem link nenhum apontando pra cá (removido de
 * ADMIN_NAV em data/admin.ts) — quem chegar aqui por um link/bookmark
 * antigo recebe um 404 normal.
 */
export default function AdminReportsPage() {
  notFound();
}
