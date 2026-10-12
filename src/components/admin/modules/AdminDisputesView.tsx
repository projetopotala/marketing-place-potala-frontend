"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DISPUTE_STATUS_LABEL,
  DISPUTE_OUTCOME_LABEL,
  listAdminDisputes,
  type DisputeResponse,
} from "@/lib/api/disputes";
import { ApiError } from "@/lib/api/client";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminDataTable, sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminStatusBadge } from "@/components/admin/shared/AdminStatusBadge";

const PAGE_SIZE = 10;

function disputeTone(status: DisputeResponse["status"]) {
  if (status === "RESOLVED" || status === "CLOSED") return "success" as const;
  if (status === "WAITING_CUSTOMER" || status === "WAITING_SELLER") return "warning" as const;
  return "info" as const;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

function originLabel(row: DisputeResponse): string {
  if (row.claimId) return `Reclamação #${row.claimId.slice(0, 8)}`;
  if (row.returnId) return `Devolução #${row.returnId.slice(0, 8)}`;
  return "—";
}

/**
 * F4 -- pós-venda do ADMIN (disputas). Real via GET /admin/disputes
 * (confirmado em admin-disputes.controller.ts e proxy-routes.ts antes de
 * escrever esta tela). `DisputesService.listForAdmin` é um `findMany`
 * cru (sem select/include) -- não traz nenhum dado do cliente/vendedor
 * envolvido, só claimId/returnId (a origem), status, outcome e datas; o
 * link de detalhe é a única forma de ver mais (decisões, por exemplo).
 *
 * Mesmo padrão de paginação/corrida/ciclo de vida de AdminClaimsView.tsx
 * (pageInfo.nextCursor direto, requestSeqRef, queueMicrotask + cleanup
 * que invalida imediatamente qualquer carga em voo).
 */
export function AdminDisputesView() {
  const [disputes, setDisputes] = useState<DisputeResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const requestSeqRef = useRef(0);

  const loadPage = useCallback(async (cursor: string | null) => {
    const seq = (requestSeqRef.current += 1);
    setIsLoading(true);
    setError(null);
    try {
      const page = await listAdminDisputes({ limit: PAGE_SIZE, cursor });
      if (requestSeqRef.current !== seq) return;
      setDisputes(page.items);
      // F4.1 -- defensivo: mesma proteção de AdminClaimsView.tsx -- uma
      // página sem itens nunca produz navegação pra frente.
      setHasNextPage(page.items.length > 0 && page.pageInfo.hasNextPage);
      setNextCursor(page.items.length > 0 ? page.pageInfo.nextCursor : null);
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      setDisputes(null);
      // F4.1 -- defeito corrigido: mesmo raciocínio de
      // AdminClaimsView.tsx -- uma falha zera hasNextPage/nextCursor em
      // vez de preservar os da última consulta bem-sucedida, então
      // "Próxima" não usa mais um cursor de uma página que falhou.
      setHasNextPage(false);
      setNextCursor(null);
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar as disputas.",
      );
    } finally {
      if (requestSeqRef.current === seq) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cursor = cursorStack[pageIndex] ?? null;
    queueMicrotask(() => {
      if (cancelled) return;
      void loadPage(cursor);
    });
    return () => {
      cancelled = true;
      requestSeqRef.current += 1;
    };
  }, [pageIndex, cursorStack, loadPage]);

  function goNext() {
    if (!hasNextPage || !nextCursor) return;
    setCursorStack((stack) => {
      const next = stack.slice(0, pageIndex + 1);
      next.push(nextCursor);
      return next;
    });
    setPageIndex((index) => index + 1);
  }

  function goPrevious() {
    if (pageIndex === 0) return;
    setPageIndex((index) => index - 1);
  }

  function retry() {
    void loadPage(cursorStack[pageIndex] ?? null);
  }

  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader
        title="Disputas"
        description="Mediações formais abertas a partir de reclamações ou devoluções, de qualquer loja."
      />

      {isLoading ? (
        <p role="status">Carregando disputas…</p>
      ) : error ? (
        <div role="alert" className={sharedStyles.stack}>
          <p style={{ color: "var(--potala-danger, #c95c57)" }}>{error}</p>
          <button type="button" className={sharedStyles.btnGhost} onClick={retry}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <AdminDataTable
          caption="Lista de disputas"
          rows={disputes ?? []}
          columns={[
            { key: "origin", header: "Origem", render: originLabel },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <AdminStatusBadge
                  label={DISPUTE_STATUS_LABEL[row.status]}
                  tone={disputeTone(row.status)}
                />
              ),
            },
            {
              key: "outcome",
              header: "Resultado",
              render: (row) => (row.outcome ? DISPUTE_OUTCOME_LABEL[row.outcome] : "—"),
            },
            {
              key: "openedAt",
              header: "Aberta em",
              render: (row) => formatDate(row.openedAt),
            },
            {
              key: "actions",
              header: "Ações",
              render: (row) => (
                <Link
                  href={`/admin/pos-venda/disputas/${row.id}`}
                  className={sharedStyles.linkBtn}
                >
                  Ver detalhes
                </Link>
              ),
            },
          ]}
          mobileCard={(row) => (
            <>
              <AdminStatusBadge
                label={DISPUTE_STATUS_LABEL[row.status]}
                tone={disputeTone(row.status)}
              />
              <strong>{originLabel(row)}</strong>
              <span>{formatDate(row.openedAt)}</span>
              <Link
                href={`/admin/pos-venda/disputas/${row.id}`}
                className={sharedStyles.linkBtn}
              >
                Ver detalhes
              </Link>
            </>
          )}
        />
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
        <button
          type="button"
          className={sharedStyles.btnGhost}
          disabled={pageIndex === 0 || isLoading}
          onClick={goPrevious}
        >
          Anterior
        </button>
        <span>Página {pageIndex + 1}</span>
        <button
          type="button"
          className={sharedStyles.btnGhost}
          disabled={!hasNextPage || isLoading}
          onClick={goNext}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
