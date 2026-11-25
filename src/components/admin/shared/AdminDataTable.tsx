"use client";

import { useState, type ReactNode } from "react";
import { Search, Download, Eye } from "lucide-react";
import { AdminMetricCard, AdminMetricsRow } from "./AdminMetricCard";
import { AdminModal } from "./AdminModal";
import { downloadCsv, toCsv } from "@/features/admin/utils/csv";
import styles from "./shared.module.css";

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface AdminDataTableProps<T extends { id: string }> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  mobileCard?: (row: T) => ReactNode;
  tools?: { describe: (row: T) => Record<string, string | number>; scope?: string };
}

export function AdminDataTable<T extends { id: string }>({
  caption,
  columns,
  rows,
  mobileCard,
  tools,
}: AdminDataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("recent");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find(row => row.id === selectedId);
  const describe = tools?.describe;
  const statuses = describe ? [...new Set(rows.map(row => String(describe(row).Status ?? "")))].filter(Boolean) : [];
  const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const filtered = describe ? rows.filter(row => {
    const fields = describe(row);
    return (!status || fields.Status === status) && normalized(Object.values(fields).join(" ")).includes(normalized(search));
  }) : rows;
  const visible = sort === "name" && describe ? [...filtered].sort((a, b) => String(Object.values(describe(a))[0]).localeCompare(String(Object.values(describe(b))[0]), "pt-BR")) : filtered;
  const scope = tools?.scope ?? "página atual";
  if (rows.length === 0 && !tools) {
    return (
      <div className={styles.empty} role="status">
        Nenhum registro encontrado.
      </div>
    );
  }

  return (
    <>
      {describe && <>
        <AdminMetricsRow><AdminMetricCard label="Registros carregados" value={String(rows.length)} hint={scope} />{statuses.slice(0, 5).map(label => <AdminMetricCard key={label} label={label} value={String(rows.filter(row => describe(row).Status === label).length)} hint={scope} />)}</AdminMetricsRow>
        <div className={styles.filterBar}>
          <label className={styles.field}><span><Search size={14} aria-hidden="true" /> Buscar na {scope}</span><input aria-label={`Buscar em ${caption}`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, código ou identificação" /></label>
          {statuses.length > 0 && <label className={styles.field}><span>Status</span><select aria-label={`Filtrar status de ${caption}`} value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos</option>{[...new Set([...statuses, ...(status ? [status] : [])])].map(label => <option key={label}>{label}</option>)}</select></label>}
          <label className={styles.field}><span>Ordenar</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Ordem original</option><option value="name">Nome / código</option></select></label>
          <button type="button" className={styles.btnSecondary} disabled={visible.length === 0} onClick={() => { const records = visible.map(describe); downloadCsv("admin-pagina-filtrada.csv", toCsv(Object.keys(records[0]), records.map(record => Object.values(record).map(String)))); }}><Download size={16} aria-hidden="true" /> Exportar página filtrada</button>
          <p className={styles.subtitle}>Busca, indicadores e exportação consideram apenas a {scope}: {visible.length} de {rows.length} registros. Use a paginação para consultar os demais.</p>
        </div>
      </>}
      {visible.length === 0 ? <div className={styles.empty} role="status">Nenhum registro encontrado.</div> : <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col">
                  {column.header}
                </th>
              ))}
              {describe && <th scope="col">Detalhes</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render(row)}</td>
                ))}
                {describe && <td><button type="button" className={styles.linkBtn} onClick={() => setSelectedId(row.id)}><Eye size={14} aria-hidden="true" /> Ver detalhes</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mobileCard ? (
        <div className={styles.mobileCards}>
          {visible.map((row) => (
            <article key={row.id} className={styles.mobileCard}>
              {mobileCard(row)}
              {describe && <div className={styles.rowActions}>{columns.find(column => column.key === "actions")?.render(row)}<button type="button" className={styles.linkBtn} onClick={() => setSelectedId(row.id)}>Ver detalhes</button></div>}
            </article>
          ))}
        </div>
      ) : null}
      </>}
      {describe && <AdminModal open={Boolean(selected)} title={`Detalhes · ${caption}`} onClose={() => setSelectedId(null)}>{selected && <dl className={styles.stack}>{Object.entries(describe(selected)).map(([label, value]) => <div key={label}><dt className={styles.subtitle}>{label}</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{value}</dd></div>)}</dl>}</AdminModal>}
    </>
  );
}

export { styles as sharedStyles };
