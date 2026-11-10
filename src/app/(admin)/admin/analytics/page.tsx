"use client";

import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "@/lib/api/client";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";

interface AnalyticsSummary {
  sessions: number;
  retentionDays: number;
  events: Array<{ event: string; count: number; valueCents: number }>;
}

const LABELS: Record<string, string> = {
  page_view: "Visitas a páginas", view_item: "Visualizações de produto", add_to_cart: "Adições ao carrinho",
  begin_checkout: "Inícios de checkout", purchase: "Compras confirmadas", sign_up: "Cadastros de clientes",
  seller_application: "Candidaturas de vendedores", contact_click: "Cliques nos canais de contato",
  view_activity: "Visualizações de atividades", enroll: "Inscrições solicitadas", download: "Downloads solicitados",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    const from = String(form.get("from") ?? "");
    const to = String(form.get("to") ?? "");
    if (from) query.set("from", new Date(`${from}T00:00:00`).toISOString());
    if (to) query.set("to", new Date(`${to}T23:59:59.999`).toISOString());
    setLoading(true);
    setError("");
    try {
      setData(await apiFetch<AnalyticsSummary>(`/admin/analytics?${query}`));
    } catch (error) {
      setData(null);
      setError(error instanceof ApiError ? error.message : "Não foi possível carregar a medição.");
    } finally { setLoading(false); }
  }

  return (
    <div>
      <AdminPageHeader title="Medição do funil" description="Eventos dos visitantes que permitiram a medição. Compras são confirmadas pelo servidor." />
      <form onSubmit={load} className="flex flex-wrap items-end gap-4 rounded-lg border border-potala-border bg-potala-panel p-4">
        <label>De<input className="potala-input" name="from" type="date" /></label>
        <label>Até<input className="potala-input" name="to" type="date" /></label>
        <button className="potala-btn potala-btn-primary" disabled={loading}>{loading ? "Carregando…" : "Consultar"}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {data && <section className="mt-6 rounded-lg border border-potala-border bg-potala-panel p-4" aria-label="Resultados da medição">
        <p>Sessões consentidas no período: {data.sessions}. Retenção dos eventos: {data.retentionDays} dias.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(LABELS).map(([event, label]) => {
            const metric = data.events.find((item) => item.event === event);
            return <li className="rounded-lg border border-potala-border p-4" key={event}>
              <span>{label}</span><strong className="block text-2xl">{metric?.count ?? 0}</strong>
              {event === "purchase" && <span>{((metric?.valueCents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>}
            </li>;
          })}
        </ul>
      </section>}
    </div>
  );
}
