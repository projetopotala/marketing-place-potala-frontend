"use client";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api/client";
import { API_BASE_URL } from "@/lib/api/config";
import { ChartNoAxesCombined } from "lucide-react";
import { AdminPageHeader } from "../shared/AdminPageHeader";
import { AdminMetricCard, AdminMetricsRow } from "../shared/AdminMetricCard";
import { sharedStyles as styles } from "../shared/AdminDataTable";
const REPORT_GROUPS = [
  { label: "Produtos e estoque", keys: ["products", "stock"] },
  { label: "Vendedores", keys: ["vendors"] },
  { label: "Clientes", keys: ["customers"] },
  {
    label: "Cursos e eventos",
    keys: ["activities", "sessions", "enrollments"],
  },
  { label: "Faturamento e comissões", keys: ["sales", "items"] },
  { label: "Pedidos", keys: ["orders"] },
  {
    label: "Pagamentos, taxas e repasses",
    keys: ["payments", "refunds", "payouts"],
  },
  { label: "Avaliações e favoritos", keys: ["reviews", "favorites"] },
  { label: "Cupons", keys: ["coupons"] },
  {
    label: "Atendimentos",
    keys: ["contacts", "returns", "claims", "disputes"],
  },
];
export function ServerReportsView() {
  const [views, setViews] = useState<
    { key: string; label: string; scoped: boolean }[]
  >([]);
  const [view, setView] = useState("sales");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    apiFetch<typeof views>("/admin/reports")
      .then((v) => { setViews(v ?? []); setView(v?.[0]?.key ?? ""); })
      .catch((e) => setError(e instanceof ApiError && [404, 501].includes(e.status)
        ? "A API de relatórios ainda não está disponível. A exportação está desabilitada."
        : e.message));
  }, []);
  async function download(format: string) {
    if (!views.some(item => item.key === view)) return;
    setBusy(true);
    setError("");
    try {
      const q = new URLSearchParams({
        format,
        ...(from ? { from: new Date(from).toISOString() } : {}),
        ...(to ? { to: new Date(to).toISOString() } : {}),
        ...(sellerId && views.find((v) => v.key === view)?.scoped
          ? { sellerId }
          : {}),
        ...(status ? { status } : {}),
      });
      const response = await fetch(
        `${API_BASE_URL}/admin/reports/${view}/export?${q}`,
        { credentials: "include" },
      );
      if (!response.ok) {
        const body = await response.json();
        throw new Error(
          Array.isArray(body.message)
            ? body.message.join(" ")
            : (body.message ?? "Exportação recusada"),
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${view}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na exportação");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.stack}>
      <AdminPageHeader title="Relatórios" description="Selecione o tipo e o período para exportar os registros do marketplace." icon={<ChartNoAxesCombined size={18} />} />
      <AdminMetricsRow><AdminMetricCard label="Relatórios disponíveis" value={String(views.length)} /><AdminMetricCard label="Limite por exportação" value="10.000" hint="Refine o período para volumes maiores" /><AdminMetricCard label="Formatos" value="CSV / XLSX" /></AdminMetricsRow>
      <p className={styles.subtitle}>
        Exportação dos registros reais, filtrados no servidor. Até 10.000
        linhas por arquivo; refine o período para volumes maiores. Valores
        financeiros em centavos. Vendas incluem comissão e taxa do gateway.
        Repasses exibem a previsão líquida; NOT_INTEGRATED e valor pago vazio
        indicam ausência de integração, sem comprovação de transferência.
        Clientes usam apenas identificador e dados de situação cadastral.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className={styles.filterBar}>
      <label className={styles.field}>
        Visão{" "}
        <select
          value={view}
          onChange={(e) => {
            setView(e.target.value);
            setStatus("");
          }}
        >
          {REPORT_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {views
                .filter((v) => group.keys.includes(v.key))
                .map((v) => (
                  <option key={v.key} value={v.key}>
                    {v.label}
                    {v.scoped ? " · por loja" : " · global"}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        De{" "}
        <input
          type="datetime-local"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Até{" "}
        <input
          type="datetime-local"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        ID da loja (opcional){" "}
        <input
          disabled={!views.find((v) => v.key === view)?.scoped}
          value={sellerId}
          onChange={(e) => setSellerId(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Status técnico (opcional){" "}
        <input value={status} onChange={(e) => setStatus(e.target.value)} />
      </label>
      </div>
      <div className={styles.actions}>
        <button
          disabled={busy || !views.length}
          onClick={() => download("csv")}
          className={styles.btnSecondary}
        >
          Exportar CSV
        </button>{" "}
        <button
          disabled={busy || !views.length}
          onClick={() => download("xlsx")}
          className={styles.btnSecondary}
        >
          Exportar XLSX
        </button>
      </div>
    </section>
  );
}
