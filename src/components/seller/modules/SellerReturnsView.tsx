"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RETURN_STATUS_LABEL,
  listMySellerReturns,
  type ReturnListItemResponse,
  type ReturnStatus,
} from "@/lib/api/returns";
import {
  DISPUTE_OUTCOME_LABEL,
  DISPUTE_STATUS_LABEL,
  getMySellerDispute,
  openMySellerReturnDispute,
  type DisputeDetailResponse,
} from "@/lib/api/disputes";
import { ApiError } from "@/lib/api/client";
import { useSellerId } from "@/features/seller/useSellerId";
import styles from "@/components/seller/seller.module.css";

const PAGE_SIZE = 10;

/**
 * `RETURN_ORIGIN_ELIGIBLE_STATUSES` (disputes.service.ts,
 * orders-service) -- confirmada lendo o service antes de mostrar o
 * botão "Abrir disputa", não presumida. Exclui exatamente COMPLETED/
 * CONTESTED/CANCELLED. Mesma lista já usada em
 * minha-conta/devolucoes/page.tsx (lado do cliente).
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

/**
 * F3 -- pós-venda do vendedor (devoluções recebidas). Real via GET
 * /seller/returns (orders-service, através do gateway -- confirmado em
 * `SellerReturnsController`/proxy-routes.ts antes de escrever esta
 * tela). SOMENTE LEITURA aqui, de propósito: o backend não tem
 * nenhuma rota de aprovação/rejeição pro vendedor (ver
 * SellerReturnsController -- "não existe aqui, de propósito, nenhuma
 * operação de aprovação/rejeição de Return para o SELLER"); essa
 * decisão continua exclusiva do ADMIN. A única ação disponível ao
 * vendedor aqui é abrir uma disputa a partir de uma devolução elegível
 * -- mesmo raciocínio e mesmo backend (`SellerClaimsController.
 * openDisputeFromReturn`) já usado no lado do cliente.
 *
 * Sem página de detalhe separada, de propósito: `ReturnsService.
 * listForSeller` já inclui produto, número do pedido e resumo de
 * disputa em cada linha (mesmo `include` de `getForSeller`, confirmado
 * lendo returns.service.ts) -- uma segunda tela de detalhe não
 * agregaria nenhum dado novo, mesma decisão de design já tomada em
 * minha-conta/devolucoes/page.tsx (lado do cliente). O detalhe completo
 * de uma disputa (decisões administrativas) é buscado por item, sob
 * demanda (clique em "Ver decisão"), nunca eagerly por toda a página.
 *
 * F3.1 -- revisão: mesma correção de cursor/condição de corrida de
 * SellerClaimsView.tsx (ver comentário lá -- `nextCursor` real da API
 * em vez de `items[items.length-1]?.id`, `requestSeqRef` contra
 * respostas fora de ordem, disparo do efeito adiado via
 * `queueMicrotask`). Também corrigido aqui: `handleExpandDispute`
 * antes engolia silenciosamente um erro de `getMySellerDispute` (só um
 * comentário "best-effort", sem nada visível pro vendedor) -- agora
 * mostra erro e permite tentar de novo, sem esconder a falha.
 */
export function SellerReturnsView() {
  const sellerId = useSellerId();

  const [returns, setReturns] = useState<ReturnListItemResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [disputeActionPendingId, setDisputeActionPendingId] = useState<string | null>(null);
  const [disputeActionError, setDisputeActionError] = useState<Record<string, string>>({});
  const [expandedDisputes, setExpandedDisputes] = useState<Record<string, DisputeDetailResponse>>(
    {},
  );
  const [expandingDisputeId, setExpandingDisputeId] = useState<string | null>(null);
  const [expandDisputeError, setExpandDisputeError] = useState<Record<string, string>>({});

  const requestSeqRef = useRef(0);

  const loadPage = useCallback(async (cursor: string | null) => {
    const seq = (requestSeqRef.current += 1);
    setIsLoading(true);
    setError(null);
    try {
      const page = await listMySellerReturns({ limit: PAGE_SIZE, cursor });
      if (requestSeqRef.current !== seq) return;
      setReturns(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
      setNextCursor(page.pageInfo.nextCursor);
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      setReturns(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as devoluções.",
      );
    } finally {
      if (requestSeqRef.current === seq) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sellerId) return;
    // F3.2 -- mesmo raciocínio de SellerClaimsView.tsx (ver comentário
    // lá): `cancelled` impede a microtarefa de nem chamar loadPage se
    // este ciclo do efeito já tiver sido limpo antes dela disparar, e a
    // limpeza incrementa `requestSeqRef` na hora, invalidando de
    // imediato qualquer requisição deste ciclo que já esteja em voo.
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
  }, [sellerId, pageIndex, cursorStack, loadPage]);

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

  async function handleOpenDispute(returnId: string) {
    setDisputeActionPendingId(returnId);
    setDisputeActionError((current) => {
      const next = { ...current };
      delete next[returnId];
      return next;
    });
    try {
      const dispute = await openMySellerReturnDispute(returnId);
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
    setExpandDisputeError((current) => {
      const next = { ...current };
      delete next[disputeId];
      return next;
    });
    try {
      const detail = await getMySellerDispute(disputeId);
      setExpandedDisputes((current) => ({ ...current, [disputeId]: detail }));
    } catch (err) {
      // F3.1: antes era só um comentário "best-effort" e nada visível --
      // agora mostra o erro e deixa tentar de novo, em vez de simplesmente
      // não expandir sem explicação.
      setExpandDisputeError((current) => ({
        ...current,
        [disputeId]:
          err instanceof ApiError ? err.message : "Não foi possível carregar a decisão.",
      }));
    } finally {
      setExpandingDisputeId(null);
    }
  }

  if (!sellerId) {
    return <p role="status">Carregando devoluções…</p>;
  }

  return (
    <>
      <header>
        <h1 className={styles.pageTitle}>Devoluções</h1>
        <p className={styles.pageLead}>
          Devoluções solicitadas por clientes sobre itens vendidos pela
          sua loja.
        </p>
      </header>

      <section className={styles.panel}>
        {isLoading ? (
          <p role="status">Carregando devoluções…</p>
        ) : error ? (
          <div role="alert">
            <p style={{ color: "var(--potala-danger, #c95c57)" }}>{error}</p>
            <button type="button" className={styles.ghostBtn} onClick={retry}>
              Tentar novamente
            </button>
          </div>
        ) : !returns || returns.length === 0 ? (
          <p>Nenhuma devolução recebida ainda.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Produto</th>
                  <th>Status</th>
                  <th>Motivo</th>
                  <th>Data</th>
                  <th>Disputa</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((item) => {
                  const dispute = item.dispute;
                  const canDispute =
                    !dispute && RETURN_ORIGIN_ELIGIBLE_STATUSES.includes(item.status);
                  const expanded = dispute ? expandedDisputes[dispute.id] : undefined;
                  const expandError = dispute ? expandDisputeError[dispute.id] : undefined;
                  return (
                    <tr key={item.id}>
                      <td>{item.orderItem.sellerOrder.order.orderNumber}</td>
                      <td>{item.orderItem.productTitle}</td>
                      <td>
                        <span className={styles.badge}>{RETURN_STATUS_LABEL[item.status]}</span>
                      </td>
                      <td>{item.reason}</td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>
                        {dispute ? (
                          <div>
                            {DISPUTE_STATUS_LABEL[dispute.status]}
                            {dispute.outcome ? ` · ${DISPUTE_OUTCOME_LABEL[dispute.outcome]}` : ""}
                            {expandError ? (
                              <p
                                role="alert"
                                style={{
                                  color: "var(--potala-danger, #c95c57)",
                                  margin: "4px 0 0",
                                  fontSize: "0.85rem",
                                }}
                              >
                                {expandError}{" "}
                                <button
                                  type="button"
                                  className={styles.rowLink}
                                  disabled={expandingDisputeId === dispute.id}
                                  onClick={() => void handleExpandDispute(dispute.id)}
                                  style={{ background: "none", border: "none", padding: 0 }}
                                >
                                  Tentar novamente
                                </button>
                              </p>
                            ) : !expanded ? (
                              <>
                                {" "}
                                <button
                                  type="button"
                                  className={styles.rowLink}
                                  disabled={expandingDisputeId === dispute.id}
                                  onClick={() => void handleExpandDispute(dispute.id)}
                                  style={{ background: "none", border: "none", padding: 0 }}
                                >
                                  {expandingDisputeId === dispute.id ? "Carregando…" : "Ver decisão"}
                                </button>
                              </>
                            ) : expanded.decisions.length > 0 ? (
                              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                                {expanded.decisions.map((decision, index) => (
                                  <li key={index}>
                                    {DISPUTE_OUTCOME_LABEL[decision.outcome]} — {decision.reason} (
                                    {formatDateTime(decision.createdAt)})
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p style={{ margin: "4px 0 0" }}>
                                Ainda sem decisão administrativa registrada.
                              </p>
                            )}
                          </div>
                        ) : canDispute ? (
                          <div>
                            <button
                              type="button"
                              className={styles.ghostBtn}
                              disabled={disputeActionPendingId === item.id}
                              onClick={() => void handleOpenDispute(item.id)}
                            >
                              {disputeActionPendingId === item.id ? "Enviando…" : "Abrir disputa"}
                            </button>
                            {disputeActionError[item.id] ? (
                              <p
                                role="alert"
                                style={{
                                  color: "var(--potala-danger, #c95c57)",
                                  margin: "6px 0 0",
                                  fontSize: "0.85rem",
                                }}
                              >
                                {disputeActionError[item.id]}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={pageIndex === 0 || isLoading}
            onClick={goPrevious}
          >
            Anterior
          </button>
          <span>Página {pageIndex + 1}</span>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={!hasNextPage || isLoading}
            onClick={goNext}
          >
            Próxima
          </button>
        </div>
      </section>
    </>
  );
}
