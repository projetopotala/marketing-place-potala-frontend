import { notFound } from "next/navigation";

/**
 * Removido do menu do admin nesta sessão (painel "Entregas", 28/09 — ver
 * status-migracao-microservicos.md). Escopo confirmado com o Arthur: o
 * fulfillment do pedido (SellerOrder.status) virou escrevível pelo
 * vendedor em /loja/entregas, mas sem transportadora nem código de
 * rastreio -- esses campos não existem no backend. A tela antiga aqui
 * (ShipmentsView.tsx, ainda no repositório mas inacessível a partir do
 * menu) mostrava exatamente isso: transportadora/rastreio/ETA
 * inteiramente inventados no mock, além de duplicar o mesmo
 * SellerOrder.status que o admin já vê de verdade em "Pedidos"
 * (GET /admin/orders). Sem link nenhum apontando pra cá (removido de
 * ADMIN_NAV em data/admin.ts) — quem chegar aqui por um link/bookmark
 * antigo recebe um 404 normal.
 */
export default function AdminShipmentsPage() {
  notFound();
}
