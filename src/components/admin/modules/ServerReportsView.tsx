"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { API_BASE_URL } from "@/lib/api/config";
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
      .then((v) => setViews(v ?? []))
      .catch((e) => setError(e.message));
  }, []);
  async function download(format: string) {
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
    <section style={{ padding: 24, display: "grid", gap: 16, maxWidth: 850 }}>
      <h1>Relatórios</h1>
      <p>
        Exportação dos registros reais, filtrados no servidor. Até 10.000
        linhas por arquivo; refine o período para volumes maiores. Valores
        financeiros em centavos. Vendas incluem comissão e taxa do gateway.
        Repasses exibem a previsão líquida; NOT_INTEGRATED e valor pago vazio
        indicam ausência de integração, sem comprovação de transferência.
        Clientes usam apenas identificador e dados de situação cadastral.
      </p>
      {error && <p role="alert">{error}</p>}
      <label>
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
      <label>
        De{" "}
        <input
          type="datetime-local"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label>
        Até{" "}
        <input
          type="datetime-local"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </label>
      <label>
        ID da loja (opcional){" "}
        <input
          disabled={!views.find((v) => v.key === view)?.scoped}
          value={sellerId}
          onChange={(e) => setSellerId(e.target.value)}
        />
      </label>
      <label>
        Status técnico (opcional){" "}
        <input value={status} onChange={(e) => setStatus(e.target.value)} />
      </label>
      <div>
        <button
          disabled={busy || !views.length}
          onClick={() => download("csv")}
        >
          Exportar CSV
        </button>{" "}
        <button
          disabled={busy || !views.length}
          onClick={() => download("xlsx")}
        >
          Exportar XLSX
        </button>
      </div>
    </section>
  );
}
