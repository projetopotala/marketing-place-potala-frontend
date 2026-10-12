"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CLAIM_STATUS_LABEL,
  listAdminClaims,
  type ClaimResponse,
} from "@/lib/api/claims";
import { ApiError } from "@/lib/api/client";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminDataTable, sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminStatusBadge } from "@/components/admin/shared/AdminStatusBadge";

const PAGE_SIZE = 10;

function claimTone(status: ClaimResponse["status"]) {
  if (status === "RESOLVED") return "success" as const;
  if (status === "CLOSED" || status === "CANCELLED") return "muted" as const;
  if (status === "ESCALATED") return "danger" as const;
  return "warning" as const;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

/**
 * F4 -- pós-venda do ADMIN (reclamações). Real via GET /admin/claims
 * (potala-orders-service, através do gateway, já roteado em
 * /api/v1/admin/claims -- confirmado em proxy-routes.ts e em
 * admin-claims.controller.ts antes de escrever esta tela, ver
 * claude/relatorio-f4-diagnostico-pos-venda-administrativo.md).
 * `ClaimsService.listForAdmin` é um `findMany` cru (mesmo raciocínio já
 * documentado em SellerClaimsView.tsx) -- não traz produto/número de
 * pedido/nome da loja, só os ids crus (sellerOrderId/sellerId). Não há
 * link para /admin/pedidos/[id]: essa página existente é dados mock de
 * outra área do painel (`useAdminData`), não a API real do Orders
 * Service -- confirmado antes de decidir não misturar os dois domínios
 * (ver diagnóstico, seção 10, "riscos de integração").
 *
 * Paginação direta por `pageInfo.nextCursor` (nunca reconstruída a
 * partir do último item da página) e proteção contra resposta fora de
 * ordem via `requestSeqRef`, com o disparo do efeito adiado por
 * `queueMicrotask` e cleanup que invalida imediatamente qualquer carga
 * em voo (incrementando o próprio `requestSeqRef`) -- mesmo padrão já
 * validado e testado em SellerClaimsView.tsx (F3.1/F3.2), replicado
 * aqui desde a primeira versão, sem necessidade de rodada de correção.
 */
export function AdminClaimsView() {
  const [claims, setClaims] = useState<ClaimResponse[] | null>(null);
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
      const page = await listAdminClaims({ limit: PAGE_SIZE, cursor });
      if (requestSeqRef.current !== seq) return; // resposta obsoleta -- descartada
      setClaims(page.items);
      // F4.1 -- defensivo: uma página sem itens nunca produz navegação
      // pra frente, mesmo que a API devolvesse hasNextPage/nextCursor
      // inconsistentes (buildPage(), no backend, já garante nextCursor
      // null quando items está vazio, mas o cursor usado por goNext()
      // nunca deve depender só disso).
      setHasNextPage(page.items.length > 0 && page.pageInfo.hasNextPage);
      setNextCursor(page.items.length > 0 ? page.pageInfo.nextCursor : null);
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      setClaims(null);
      // F4.1 -- defeito corrigido: antes, uma falha preservava
      // hasNextPage/nextCursor da última consulta bem-sucedida, então
      // "Próxima" continuava habilitado e `goNext()` usava um cursor de
      // uma página que nem terminou de carregar. Agora, qualquer falha
      // zera os dois -- "Próxima" fica desabilitado até uma nova carga
      // bem-sucedida (via "Tentar novamente", que usa o cursor desta
      // MESMA página, armazenado em `cursorStack`, nunca afetado por
      // isto). "Anterior" continua disponível (depende só de `pageIndex`).
      setHasNextPage(false);
      setNextCursor(null);
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar as reclamações.",
      );
    } finally {
      if (requestSeqRef.current === seq) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Mesmo raciocínio de SellerClaimsView.tsx (F3.2): `cancelled` evita
    // que a microtarefa dispare `loadPage` se este ciclo do efeito já
    // tiver sido limpo (troca de página, Strict Mode em dev), e a
    // limpeza incrementa `requestSeqRef` na hora, invalidando de
    // imediato qualquer requisição deste ciclo já em voo.
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
        title="Reclamações"
        description="Todas as reclamações do marketplace, de qualquer loja."
      />

      {isLoading ? (
        <p role="status">Carregando reclamações…</p>
      ) : error ? (
        <div role="alert" className={sharedStyles.stack}>
          <p style={{ color: "var(--potala-danger, #c95c57)" }}>{error}</p>
          <button type="button" className={sharedStyles.btnGhost} onClick={retry}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <AdminDataTable
          caption="Lista de reclamações"
          rows={claims ?? []}
          columns={[
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <AdminStatusBadge
                  label={CLAIM_STATUS_LABEL[row.status]}
                  tone={claimTone(row.status)}
                />
              ),
            },
            { key: "reason", header: "Motivo", render: (row) => row.reason },
            {
              key: "createdAt",
              header: "Aberta em",
              render: (row) => formatDate(row.createdAt),
            },
            {
              key: "actions",
              header: "Ações",
              render: (row) => (
                <Link
                  href={`/admin/pos-venda/reclamacoes/${row.id}`}
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
                label={CLAIM_STATUS_LABEL[row.status]}
                tone={claimTone(row.status)}
              />
              <strong>{row.reason}</strong>
              <span>{formatDate(row.createdAt)}</span>
              <Link
                href={`/admin/pos-venda/reclamacoes/${row.id}`}
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
