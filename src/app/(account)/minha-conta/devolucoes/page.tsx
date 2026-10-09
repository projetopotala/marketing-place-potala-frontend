"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AccountChrome } from "@/components/account/AccountChrome";
import { ApiError } from "@/lib/api/client";
import {
  RETURN_STATUS_LABEL,
  listMyReturns,
  type ReturnListItemResponse,
  type ReturnStatus,
} from "@/lib/api/returns";
import {
  DISPUTE_OUTCOME_LABEL,
  DISPUTE_STATUS_LABEL,
  getMyDispute,
  openMyReturnDispute,
  type DisputeDetailResponse,
} from "@/lib/api/disputes";

const PAGE_SIZE = 10;

/**
 * `RETURN_ORIGIN_ELIGIBLE_STATUSES` (disputes.service.ts, orders-service)
 * -- confirmada de novo nesta rodada antes de mostrar o botão "Abrir
 * disputa", não presumida. Exclui exatamente COMPLETED/CONTESTED/
 * CANCELLED (uma devolução já concluída, já em disputa, ou já cancelada
 * não pode abrir outra disputa).
 */
const RETURN_ORIGIN_ELIGIBLE_STATUSES: readonly ReturnStatus[] = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "AWAITING_SHIPMENT",
  "SHIPPED",
  "RECEIVED",
  "UNDER_REVIEW",
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

/**
 * Real via GET /orders/returns (orders-service, através do gateway) --
 * substitui o mock antigo (`useAccountData`, `db.returns`, `createReturn`
 * em localStorage). Diferente da tela antiga, esta página agora é só
 * leitura -- solicitar uma devolução acontece no detalhe do pedido
 * (`/minha-conta/pedidos/[id]`, `OrderItemReturnForm`), mesmo lugar onde
 * já vive o formulário de avaliação, porque a elegibilidade (SellerOrder
 * DELIVERED) e a identidade do item só existem naquela tela -- juntar tudo
 * aqui de novo exigiria refazer a mesma busca de pedidos elegíveis, sem
 * ganho real.
 *
 * Disputa (F2): `ReturnListItemResponse.dispute` já vem com o resumo
 * (status/outcome) em toda listagem (`ReturnsService.listForCustomer`,
 * ver returns.ts/diagnóstico F1) -- mostrado direto, sem chamada extra. O
 * detalhe completo (decisões administrativas) só é buscado por item,
 * sob demanda (clique em "Ver decisão"), nunca eagerly por toda a página
 * -- evita N chamadas extras ao carregar a lista.
 */
export default function AccountReturnsPage() {
  const [returns, setReturns] = useState<ReturnListItemResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [disputeActionPendingId, setDisputeActionPendingId] = useState<string | null>(null);
  const [disputeActionError, setDisputeActionError] = useState<Record<string, string>>({});
  const [expandedDisputes, setExpandedDisputes] = useState<Record<string, DisputeDetailResponse>>(
    {},
  );
  const [expandingDisputeId, setExpandingDisputeId] = useState<string | null>(null);

  const loadPage = useCallback(async (cursor: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await listMyReturns({ limit: PAGE_SIZE, cursor });
      setReturns(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setReturns(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar suas devoluções.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(cursorStack[pageIndex] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, loadPage]);

  function goNext() {
    if (!hasNextPage || !returns || returns.length === 0) return;
    const nextCursor = returns[returns.length - 1]?.id ?? null;
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

  async function handleOpenDispute(returnId: string) {
    setDisputeActionPendingId(returnId);
    setDisputeActionError((current) => {
      const next = { ...current };
      delete next[returnId];
      return next;
    });
    try {
      const dispute = await openMyReturnDispute(returnId);
      setReturns((current) =>
        current
          ? current.map((item) =>
              item.id === returnId
                ? {
                    ...item,
                    status: "CONTESTED",
                    dispute: {
                      id: dispute.id,
                      status: dispute.status,
                      outcome: dispute.outcome,
                      openedAt: dispute.openedAt,
                      resolvedAt: dispute.resolvedAt,
                    },
                  }
                : item,
            )
          : current,
      );
    } catch (err) {
      setDisputeActionError((current) => ({
        ...current,
        [returnId]: err instanceof ApiError ? err.message : "Não foi possível abrir a disputa.",
      }));
    } finally {
      setDisputeActionPendingId(null);
    }
  }

  async function handleExpandDispute(disputeId: string) {
    setExpandingDisputeId(disputeId);
    try {
      const detail = await getMyDispute(disputeId);
      setExpandedDisputes((current) => ({ ...current, [disputeId]: detail }));
    } catch {
      // Best-effort: a tela já mostra o resumo (status/outcome); se o
      // detalhe completo falhar, apenas não expande, sem quebrar a lista.
    } finally {
      setExpandingDisputeId(null);
    }
  }

  return (
    <AccountChrome
      title="Devoluções"
      lead="Solicite uma devolução no detalhe de um pedido entregue. Aqui ficam suas solicitações."
      breadcrumbCurrent="Devoluções"
    >
      <p>
        Para solicitar uma devolução, acesse{" "}
        <Link href="/minha-conta/pedidos">Meus Pedidos</Link> e abra o
        pedido desejado -- o formulário aparece nos itens já entregues.
      </p>

      <section style={{ marginTop: 24 }}>
        <h2>Solicitações</h2>
        {isLoading ? (
          <p role="status">Carregando…</p>
        ) : error ? (
          <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
            {error}
          </p>
        ) : !returns || returns.length === 0 ? (
          <p>Nenhuma devolução solicitada ainda.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {returns.map((item) => {
              const dispute = item.dispute;
              const canDispute =
                !dispute && RETURN_ORIGIN_ELIGIBLE_STATUSES.includes(item.status);
              const expanded = dispute ? expandedDisputes[dispute.id] : undefined;
              return (
                <li
                  key={item.id}
                  style={{
                    border: "1px solid var(--potala-border)",
                    borderRadius: "var(--potala-radius-control, 10px)",
                    padding: 12,
                  }}
                >
                  Pedido {item.orderItem.sellerOrder.order.orderNumber} ·{" "}
                  {item.orderItem.productTitle} ·{" "}
                  {RETURN_STATUS_LABEL[item.status]} · {item.reason}
                  {dispute ? (
                    <div style={{ marginTop: 8, color: "var(--potala-muted, #6b6b6b)" }}>
                      Em disputa: {DISPUTE_STATUS_LABEL[dispute.status]}
                      {dispute.outcome
                        ? ` · ${DISPUTE_OUTCOME_LABEL[dispute.outcome]}`
                        : ""}
                      {!expanded ? (
                        <>
                          {" "}
                          <button
                            type="button"
                            disabled={expandingDisputeId === dispute.id}
                            onClick={() => void handleExpandDispute(dispute.id)}
                            style={{
                              border: "none",
                              background: "none",
                              color: "var(--potala-gold)",
                              cursor: "pointer",
                              padding: 0,
                              textDecoration: "underline",
                            }}
                          >
                            Ver decisão
                          </button>
                        </>
                      ) : expanded.decisions.length > 0 ? (
                        <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                          {expanded.decisions.map((decision, index) => (
                            <li key={index}>
                              {DISPUTE_OUTCOME_LABEL[decision.outcome]} — {decision.reason} (
                              {formatDateTime(decision.createdAt)})
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ margin: "4px 0 0" }}>Ainda sem decisão administrativa registrada.</p>
                      )}
                    </div>
                  ) : canDispute ? (
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        disabled={disputeActionPendingId === item.id}
                        onClick={() => void handleOpenDispute(item.id)}
                        style={{
                          padding: "0.4rem 0.9rem",
                          border: "1px solid var(--potala-danger, #c95c57)",
                          borderRadius: "var(--potala-radius-button, 8px)",
                          background: "transparent",
                          color: "var(--potala-danger, #c95c57)",
                          cursor: disputeActionPendingId === item.id ? "default" : "pointer",
                          fontSize: "0.85rem",
                        }}
                      >
                        {disputeActionPendingId === item.id ? "Enviando…" : "Abrir disputa"}
                      </button>
                      {disputeActionError[item.id] ? (
                        <p
                          role="alert"
                          style={{ color: "var(--potala-danger, #c95c57)", margin: "6px 0 0", fontSize: "0.85rem" }}
                        >
                          {disputeActionError[item.id]}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
          <button type="button" disabled={pageIndex === 0 || isLoading} onClick={goPrevious}>
            Anterior
          </button>
          <span>Página {pageIndex + 1}</span>
          <button type="button" disabled={!hasNextPage || isLoading} onClick={goNext}>
            Próxima
          </button>
        </div>
      </section>
    </AccountChrome>
  );
}
