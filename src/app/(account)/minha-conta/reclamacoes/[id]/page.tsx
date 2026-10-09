"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AccountChrome } from "@/components/account/AccountChrome";
import { ApiError } from "@/lib/api/client";
import { getMyOrder } from "@/lib/api/orders";
import {
  CLAIM_STATUS_LABEL,
  cancelMyClaim,
  getMyClaim,
  addMyClaimMessage,
  resolveMyClaim,
  type ClaimAuthorRole,
  type ClaimDetailResponse,
} from "@/lib/api/claims";
import {
  DISPUTE_OUTCOME_LABEL,
  DISPUTE_STATUS_LABEL,
  getMyDispute,
  openMyClaimDispute,
  type DisputeDetailResponse,
} from "@/lib/api/disputes";

/**
 * As três fases "em conversa" de uma Claim -- idênticas nas três
 * allow-lists do backend que decidem o que o CUSTOMER pode fazer aqui
 * (confirmado lendo claims.service.ts/disputes.service.ts antes de
 * desenhar os botões, não presumido):
 * - `CLAIM_STATUSES_OPEN_FOR_INPUT` (claims.service.ts) -- aceita
 *   mensagem/evidência nova.
 * - `CLAIM_ORIGIN_ELIGIBLE_STATUSES` (disputes.service.ts) -- aceita abrir
 *   disputa a partir desta Claim.
 * - A interseção de `CLAIM_TRANSITIONS[status]` com
 *   `CLAIM_ROLE_TARGETS[CUSTOMER] = [CANCELLED, RESOLVED]` (claims.
 *   service.ts) -- de OPEN/SELLER_RESPONSE_REQUIRED/
 *   CUSTOMER_RESPONSE_REQUIRED o cliente pode ir pra RESOLVED ou
 *   CANCELLED; de RESOLVED/ESCALADA/CLOSED/CANCELLED não pode mais nada.
 * As três allow-lists têm exatamente os mesmos três valores -- por isso
 * um único array aqui, não três.
 */
const CLAIM_LIVE_STATUSES = [
  "OPEN",
  "SELLER_RESPONSE_REQUIRED",
  "CUSTOMER_RESPONSE_REQUIRED",
] as const;

function isClaimLive(status: string): boolean {
  return (CLAIM_LIVE_STATUSES as readonly string[]).includes(status);
}

const AUTHOR_ROLE_LABEL: Record<ClaimAuthorRole, string> = {
  CUSTOMER: "Você",
  SELLER: "Vendedor",
  ADMIN: "Equipe Potala",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ConfirmTarget = "resolve" | "cancel" | "dispute" | null;

const panelStyle = {
  marginTop: 20,
  padding: 16,
  background: "var(--potala-panel)",
  border: "1px solid var(--potala-border)",
  borderRadius: "var(--potala-radius-control, 12px)",
} as const;

const sectionHeadingStyle = {
  margin: "0 0 12px",
  fontSize: "1.05rem",
  fontWeight: 600,
  color: "var(--potala-gold)",
} as const;

export default function AccountClaimDetailPage() {
  const params = useParams<{ id: string }>();
  const [claim, setClaim] = useState<ClaimDetailResponse | null>(null);
  const [orderContext, setOrderContext] = useState<{
    orderNumber: string;
    productTitle: string;
    sku: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dispute, setDispute] = useState<DisputeDetailResponse | null>(null);
  const [isDisputeLoading, setIsDisputeLoading] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const [messageBody, setMessageBody] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * `load` continua assíncrona por dentro (é reaproveitada por
   * handleSendMessage/confirmAction, que dependem de `await load(...)`
   * depois de uma ação bem-sucedida) -- mas chamar uma função declarada
   * com `async` diretamente de dentro de um `useEffect` é sinalizado
   * pela regra `react-hooks/set-state-in-effect`, mesmo quando todo
   * `setState` já acontece depois de um `await` (o lint não analisa o
   * que vem depois, só que o efeito invoca uma função assíncrona que
   * atualiza estado). A IIFE abaixo preserva exatamente a mesma lógica,
   * ordem de execução e tratamento de erro -- só move a palavra-chave
   * `async` para dentro, então `load` deixa de ser, ela mesma, uma
   * função assíncrona aos olhos do lint, mas ainda devolve a mesma
   * Promise de antes (por isso handleSendMessage/confirmAction continuam
   * podendo fazer `await load(claim.id)` sem nenhuma mudança).
   */
  const load = useCallback((id: string) => {
    return (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await getMyClaim(id);
        setClaim(result);

        // Contexto de produto/pedido: recuperável via GET /orders/:id (já
        // existente, orders.ts) -- ClaimsService.getForCustomer não inclui
        // orderItem/order (ver claims.ts), então isto é uma segunda chamada
        // real, nunca um dado inventado. Best-effort: se falhar, a página
        // continua funcionando sem esse contexto, nunca bloqueia o resto.
        try {
          const order = await getMyOrder(result.orderId);
          const item = order.sellerOrders
            .flatMap((sellerOrder) => sellerOrder.items)
            .find((candidate) => candidate.id === result.orderItemId);
          setOrderContext(
            item
              ? { orderNumber: order.orderNumber, productTitle: item.productTitle, sku: item.sku }
              : null,
          );
        } catch {
          setOrderContext(null);
        }

        if (result.dispute) {
          setIsDisputeLoading(true);
          setDisputeError(null);
          try {
            const disputeDetail = await getMyDispute(result.dispute.id);
            setDispute(disputeDetail);
          } catch (err) {
            setDispute(null);
            setDisputeError(
              err instanceof ApiError
                ? err.message
                : "Não foi possível carregar a disputa vinculada.",
            );
          } finally {
            setIsDisputeLoading(false);
          }
        } else {
          setDispute(null);
          setDisputeError(null);
        }
      } catch (err) {
        setClaim(null);
        setLoadError(
          err instanceof ApiError ? err.message : "Reclamação não encontrada.",
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    void load(params.id);
  }, [params.id, load]);

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSendingMessage || !claim) return;
    const body = messageBody.trim();
    if (!body) return;
    setIsSendingMessage(true);
    setMessageError(null);
    try {
      // O backend devolve a ClaimMessage criada, não a Claim inteira (ver
      // claims.ts) -- por isso recarregamos o detalhe completo abaixo em
      // vez de só anexar a mensagem localmente: uma mensagem do cliente
      // também pode mover o status (ex.: para SELLER_RESPONSE_REQUIRED),
      // e só o GET .../claims/:id reflete esse novo estado.
      await addMyClaimMessage(claim.id, body);
      setMessageBody("");
      await load(claim.id);
    } catch (err) {
      setMessageError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível enviar sua mensagem. Tente novamente.",
      );
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function confirmAction() {
    if (!claim || !confirmTarget) return;
    setIsSubmittingAction(true);
    setActionError(null);
    try {
      if (confirmTarget === "resolve") {
        await resolveMyClaim(claim.id);
      } else if (confirmTarget === "cancel") {
        await cancelMyClaim(claim.id);
      } else {
        await openMyClaimDispute(claim.id);
      }
      setConfirmTarget(null);
      await load(claim.id);
    } catch (err) {
      // 409 (transição não permitida nesse status, ou disputa já aberta)
      // e 403 (papel sem permissão para o alvo) já vêm com mensagem
      // pronta do backend -- nunca tratamos como sucesso.
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível concluir a ação. Tente novamente.",
      );
    } finally {
      setIsSubmittingAction(false);
    }
  }

  if (isLoading) {
    return (
      <AccountChrome title="Reclamação" breadcrumbCurrent="Detalhe da reclamação">
        <p role="status">Carregando…</p>
      </AccountChrome>
    );
  }

  if (loadError || !claim) {
    return (
      <AccountChrome title="Reclamação" breadcrumbCurrent="Detalhe da reclamação">
        <p role="alert">
          {loadError ?? "Reclamação não encontrada."}{" "}
          <Link href="/minha-conta/reclamacoes">Voltar à lista</Link>
        </p>
      </AccountChrome>
    );
  }

  const live = isClaimLive(claim.status);

  return (
    <AccountChrome
      title={`Reclamação · ${CLAIM_STATUS_LABEL[claim.status]}`}
      breadcrumbCurrent="Detalhe da reclamação"
    >
      <p
        style={{
          margin: "0 0 20px",
          padding: "10px 14px",
          background: "var(--potala-panel)",
          border: "1px solid var(--potala-border)",
          borderRadius: "var(--potala-radius-control, 10px)",
          color: "var(--potala-cream)",
          fontSize: "0.95rem",
        }}
      >
        {orderContext ? (
          <>
            Pedido {orderContext.orderNumber} · {orderContext.productTitle} (
            {orderContext.sku})
            <br />
          </>
        ) : null}
        Motivo: {claim.reason}
        {claim.description ? (
          <>
            <br />
            {claim.description}
          </>
        ) : null}
        <br />
        Aberta em {formatDateTime(claim.createdAt)}
        {claim.resolvedAt ? ` · Resolvida em ${formatDateTime(claim.resolvedAt)}` : ""}
      </p>

      {claim.dispute ? (
        <section style={panelStyle}>
          <h2 style={sectionHeadingStyle}>Disputa</h2>
          {isDisputeLoading ? (
            <p role="status">Carregando disputa…</p>
          ) : disputeError ? (
            <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
              {disputeError}
            </p>
          ) : dispute ? (
            <>
              <p style={{ margin: 0 }}>
                Situação: {DISPUTE_STATUS_LABEL[dispute.status]}
                {dispute.outcome ? ` · Resultado: ${DISPUTE_OUTCOME_LABEL[dispute.outcome]}` : ""}
              </p>
              {dispute.decisions.length > 0 ? (
                <ul style={{ marginTop: 12, paddingLeft: 18 }}>
                  {dispute.decisions.map((decision, index) => (
                    <li key={index} style={{ marginBottom: 6 }}>
                      {DISPUTE_OUTCOME_LABEL[decision.outcome]} — {decision.reason} (
                      {formatDateTime(decision.createdAt)})
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: "8px 0 0", color: "var(--potala-muted, #6b6b6b)" }}>
                  Ainda sem decisão administrativa registrada.
                </p>
              )}
            </>
          ) : null}
        </section>
      ) : null}

      <section style={panelStyle}>
        <h2 style={sectionHeadingStyle}>Mensagens</h2>
        {claim.messages.length === 0 ? (
          <p style={{ margin: 0, color: "var(--potala-muted, #6b6b6b)" }}>
            Nenhuma mensagem ainda.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {claim.messages.map((message) => (
              <li
                key={message.id}
                style={{
                  padding: 10,
                  border: "1px solid var(--potala-border)",
                  borderRadius: "var(--potala-radius-control, 10px)",
                }}
              >
                <strong style={{ color: "var(--potala-cream)" }}>
                  {AUTHOR_ROLE_LABEL[message.authorRole]}
                </strong>
                {" · "}
                <span style={{ color: "var(--potala-muted, #6b6b6b)", fontSize: "0.85rem" }}>
                  {formatDateTime(message.createdAt)}
                </span>
                <p style={{ margin: "6px 0 0" }}>{message.body}</p>
              </li>
            ))}
          </ul>
        )}

        {claim.evidence.length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "0.9rem", color: "var(--potala-cream)" }}>
              Evidências anexadas
            </h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {claim.evidence.map((item) => (
                <li key={item.id} style={{ marginBottom: 4 }}>
                  {item.fileName} ({formatBytes(item.sizeBytes)}) —{" "}
                  {AUTHOR_ROLE_LABEL[item.uploadedByRole]}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {live ? (
          <form onSubmit={handleSendMessage} style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <label
              style={{
                display: "grid",
                gap: 6,
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--potala-cream)",
              }}
            >
              Nova mensagem
              <textarea
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                maxLength={4000}
                rows={3}
                required
                disabled={isSendingMessage}
                style={{
                  width: "100%",
                  resize: "vertical",
                  padding: "0.5rem 0.75rem",
                  border: "1px solid var(--potala-border)",
                  borderRadius: "var(--potala-radius-control, 10px)",
                  background: "var(--potala-bg)",
                  color: "var(--potala-text)",
                  fontSize: "0.9rem",
                  fontWeight: 400,
                }}
              />
            </label>
            {messageError ? (
              <p role="alert" style={{ color: "var(--potala-danger, #c95c57)", margin: 0, fontSize: "0.85rem" }}>
                {messageError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isSendingMessage}
              style={{
                justifySelf: "start",
                padding: "0.6rem 1.25rem",
                border: "none",
                borderRadius: "var(--potala-radius-button, 8px)",
                background: "var(--potala-gold)",
                color: "var(--potala-bg)",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: isSendingMessage ? "default" : "pointer",
                opacity: isSendingMessage ? 0.7 : 1,
              }}
            >
              {isSendingMessage ? "Enviando…" : "Enviar mensagem"}
            </button>
          </form>
        ) : (
          <p style={{ marginTop: 16, color: "var(--potala-muted, #6b6b6b)" }}>
            Esta reclamação não está mais aberta para novas mensagens.
          </p>
        )}
      </section>

      {live ? (
        <section style={panelStyle}>
          <h2 style={sectionHeadingStyle}>Ações</h2>
          {actionError ? (
            <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
              {actionError}
            </p>
          ) : null}

          {confirmTarget ? (
            <div style={{ display: "grid", gap: 10 }}>
              <p style={{ margin: 0 }}>
                {confirmTarget === "resolve"
                  ? "Confirma marcar esta reclamação como resolvida?"
                  : confirmTarget === "cancel"
                    ? "Confirma cancelar esta reclamação?"
                    : "Isto abre uma mediação formal com o Instituto Potala. Deseja continuar?"}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={isSubmittingAction}
                  onClick={() => void confirmAction()}
                  style={{
                    padding: "0.5rem 1rem",
                    border: "none",
                    borderRadius: "var(--potala-radius-button, 8px)",
                    background: "var(--potala-gold)",
                    color: "var(--potala-bg)",
                    fontWeight: 600,
                    cursor: isSubmittingAction ? "default" : "pointer",
                    opacity: isSubmittingAction ? 0.7 : 1,
                  }}
                >
                  {isSubmittingAction ? "Enviando…" : "Confirmar"}
                </button>
                <button
                  type="button"
                  disabled={isSubmittingAction}
                  onClick={() => setConfirmTarget(null)}
                  style={{
                    padding: "0.5rem 1rem",
                    border: "1px solid var(--potala-border)",
                    borderRadius: "var(--potala-radius-button, 8px)",
                    background: "transparent",
                    color: "var(--potala-text)",
                  }}
                >
                  Voltar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setConfirmTarget("resolve")}
                style={{
                  padding: "0.5rem 1rem",
                  border: "none",
                  borderRadius: "var(--potala-radius-button, 8px)",
                  background: "var(--potala-gold)",
                  color: "var(--potala-bg)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Marcar como resolvida
              </button>
              <button
                type="button"
                onClick={() => setConfirmTarget("cancel")}
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid var(--potala-border)",
                  borderRadius: "var(--potala-radius-button, 8px)",
                  background: "transparent",
                  color: "var(--potala-text)",
                  cursor: "pointer",
                }}
              >
                Cancelar reclamação
              </button>
              {!claim.dispute ? (
                <button
                  type="button"
                  onClick={() => setConfirmTarget("dispute")}
                  style={{
                    padding: "0.5rem 1rem",
                    border: "1px solid var(--potala-danger, #c95c57)",
                    borderRadius: "var(--potala-radius-button, 8px)",
                    background: "transparent",
                    color: "var(--potala-danger, #c95c57)",
                    cursor: "pointer",
                  }}
                >
                  Abrir disputa
                </button>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </AccountChrome>
  );
}
