"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { API_BASE_URL } from "@/lib/api/config";
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
        ...(sellerId ? { sellerId } : {}),
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
        Exportação dos registros reais, filtrados no servidor. Até 10.000 linhas
        por arquivo; refine o período para volumes maiores. Valores financeiros
        em centavos.
      </p>
      {error && <p role="alert">{error}</p>}
      <label>
        Visão{" "}
        <select value={view} onChange={(e) => setView(e.target.value)}>
          {views.map((v) => (
            <option key={v.key} value={v.key}>
              {v.label}
              {v.scoped ? " · aceita escopo por loja" : " · escopo global"}
            </option>
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
        <input value={sellerId} onChange={(e) => setSellerId(e.target.value)} />
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
