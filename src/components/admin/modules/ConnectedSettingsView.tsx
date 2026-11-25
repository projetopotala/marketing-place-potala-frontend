"use client";

import Link from "next/link";
import { useState } from "react";
import { Settings } from "lucide-react";
import { AdminPageHeader } from "../shared/AdminPageHeader";
import { sharedStyles as styles } from "../shared/AdminDataTable";
import { FinancialPolicies } from "./FinancialPolicies";
import modules from "./modules.module.css";

const tabs = ["Identidade", "Comissões", "Entregas", "Pagamentos", "Notificações", "Segurança"];
export function ConnectedSettingsView() {
  const [tab, setTab] = useState("Identidade");
  return <div className={styles.stack}>
    <AdminPageHeader title="Configurações" description="Preferências e políticas do marketplace" icon={<Settings size={18} />} />
    <div className={modules.tabs} aria-label="Seções de configurações">{tabs.map(label => <button type="button" key={label} className={tab === label ? modules.tabActive : modules.tab} aria-pressed={tab === label} onClick={() => setTab(label)}>{label}</button>)}</div>
    {tab === "Comissões" ? <FinancialPolicies /> : <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{tab}</h2>
      {tab === "Identidade" && <><label className={styles.field}>Nome do marketplace<input value="Instituto Potala" readOnly /></label><p className={styles.subtitle}>A edição da identidade visual ainda não está disponível.</p><button className={styles.btn} disabled>Salvar identidade</button></>}
      {tab === "Entregas" && <><p className={styles.subtitle}>Acompanhe o andamento dos pedidos. As preferências de entrega são gerenciadas pelas lojas.</p><Link className={styles.linkBtn} href="/admin/entregas">Consultar entregas</Link></>}
      {tab === "Pagamentos" && <><p className={styles.subtitle}>A conexão com gateways de pagamento ainda não está disponível.</p><Link className={styles.linkBtn} href="/admin/financeiro/integracoes">Ver integrações</Link></>}
      {tab === "Notificações" && <><p className={styles.subtitle}>Consulte as notificações disponíveis. A edição de preferências gerais ainda não está disponível.</p><Link className={styles.linkBtn} href="/admin/notificacoes">Ver notificações</Link></>}
      {tab === "Segurança" && <><p className={styles.subtitle}>Gerencie os administradores autorizados a acessar o painel.</p><Link className={styles.linkBtn} href="/admin/administradores">Gerenciar administradores</Link></>}
    </section>}
  </div>;
}
