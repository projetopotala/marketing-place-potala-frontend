import { notFound } from "next/navigation";

/**
 * Removido do menu do admin nesta sessão (29/09 — ver
 * status-migracao-microservicos.md). A tela tinha 6 abas (Identidade,
 * Comissões, Entregas, Pagamentos, Notificações, Segurança) editando só
 * o banco demo local (useAdminData/repo.saveSettings) — não existe
 * nenhum endpoint de configuração de marketplace em nenhum backend, e as
 * abas Pagamentos/Comissões dependem diretamente da decisão de gateway
 * de pagamento (Fase C) que o Arthur decidiu deixar pro final. A tela
 * antiga (SettingsView.tsx, ainda no repositório mas inacessível a
 * partir do menu) fica pra ser revisitada nessa hora. Sem link nenhum
 * apontando pra cá (removido de ADMIN_NAV em data/admin.ts) — quem
 * chegar aqui por um link/bookmark antigo recebe um 404 normal.
 */
export default function AdminSettingsPage() {
  notFound();
}
