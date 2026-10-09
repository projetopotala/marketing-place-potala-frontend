"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { getMySellerOrder } from "@/lib/api/orders";
import {
  CLAIM_STATUS_LABEL,
  getMySellerClaim,
  addMySellerClaimMessage,
  type ClaimAuthorRole,
  type ClaimDetailResponse,
} from "@/lib/api/claims";
import {
  DISPUTE_OUTCOME_LABEL,
  DISPUTE_STATUS_LABEL,
  getMySellerDispute,
  openMySellerClaimDispute,
  type DisputeDetailResponse,
} from "@/lib/api/disputes";
import styles from "@/components/seller/seller.module.css";

/**
 * As três fases "em conversa" de uma Claim -- confirmadas lendo
 * claims.service.ts/disputes.service.ts antes de desenhar os botões,
 * não presumidas (mesmo raciocínio já documentado em
 * minha-conta/reclamacoes/[id]/page.tsx, lado do cliente):
 * - `CLAIM_STATUSES_OPEN_FOR_INPUT` (claims.service.ts) -- aceita
 *   mensagem nova do vendedor.
 * - `CLAIM_ORIGIN_ELIGIBLE_STATUSES` (disputes.service.ts) -- aceita
 *   abrir disputa a partir desta Claim.
 * As duas allow-lists têm exatamente os mesmos três valores.
 *
 * CRÍTICO, diferente da tela do cliente: `CLAIM_ROLE_TARGETS[SELLER]`
 * é uma lista VAZIA em claims.service.ts -- o vendedor não tem
 * NENHUMA transição manual de status (nem resolver, nem cancelar, nem
 * escalar diretamente). A única ação de "Ações" aqui é abrir disputa
 * (que o backend trata como escalonamento formal, não como uma
 * transição manual de ClaimStatus pelo papel SELLER). Responder
 * (`addMySellerClaimMessage`) já move a Claim para
 * CUSTOMER_RESPONSE_REQUIRED automaticamente no backend -- nenhum botão
 * extra é necessário ou permitido para isso.
 *
 * F3.1 -- revisão: `load` deixou de ser uma função não-`async`
 * devolvendo a Promise de uma IIFE assíncrona interna (truque que só
 * escondia o aviso do ESLint sem mudar nada de fato) -- agora é um
 * `useCallback` `async` direto, igual ao de SellerClaimsView/
 * SellerReturnsView. `requestSeqRef` guarda contra duas situações: (1)
 * o vendedor navega direto de uma reclamação para outra (`params.id`
 * muda) antes da primeira carga terminar -- a resposta mais lenta da
 * reclamação ANTERIOR não deve sobrescrever a mais nova; (2) o
 * componente desmonta com uma carga em voo. O disparo do efeito é
 * adiado via `queueMicrotask`, pelo mesmo motivo do comentário em
 * SellerClaimsView.tsx.
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
  CUSTOMER: "Cliente",
  SELLER: "Você",
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

export function SellerClaimDetailView() {
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

  const [isConfirmingDispute, setIsConfirmingDispute] = useState(false);
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [disputeActionError, setDisputeActionError] = useState<string | null>(null);

  const requestSeqRef = useRef(0);

  const load = useCallback(async (id: string) => {
    const seq = (requestSeqRef.current += 1);
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await getMySellerClaim(id);
      if (requestSeqRef.current !== seq) return; // navegou pra outra reclamação -- descarta

      setClaim(result);

      // Contexto de produto/pedido: `ClaimsService.getForSeller` não
      // inclui orderItem/order (ver claims.ts) -- GET /seller/orders/:id
      // (orders.ts, já existente) é a segunda chamada real que preenche
      // isso, nunca um dado inventado. Best-effort: se falhar, a página
      // continua funcionando sem esse contexto.
      try {
        const sellerOrder = await getMySellerOrder(result.sellerOrderId);
        if (requestSeqRef.current !== seq) return;
        const item = sellerOrder.items.find(
          (candidate) => candidate.id === result.orderItemId,
        );
        setOrderContext(
          item
            ? {
                orderNumber: sellerOrder.order.orderNumber,
                productTitle: item.productTitle,
                sku: item.sku,
              }
            : null,
        );
      } catch {
        if (requestSeqRef.current === seq) setOrderContext(null);
      }

      if (requestSeqRef.current !== seq) return;

      if (result.dispute) {
        setIsDisputeLoading(true);
        setDisputeError(null);
        try {
          const disputeDetail = await getMySellerDispute(result.dispute.id);
          if (requestSeqRef.current !== seq) return;
          setDispute(disputeDetail);
        } catch (err) {
          if (requestSeqRef.current !== seq) return;
          setDispute(null);
          setDisputeError(
            err instanceof ApiError
              ? err.message
              : "Não foi possível carregar a disputa vinculada.",
          );
        } finally {
          if (requestSeqRef.current === seq) setIsDisputeLoading(false);
        }
      } else {
        setDispute(null);
        setDisputeError(null);
      }
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      setClaim(null);
      setLoadError(
        err instanceof ApiError ? err.message : "Reclamação não encontrada.",
      );
    } finally {
      if (requestSeqRef.current === seq) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // F3.2 -- mesmo raciocínio de SellerClaimsView.tsx: `cancelled`
    // impede a microtarefa de chamar `load` se o efeito já tiver sido
    // limpo (por exemplo, o vendedor navegou pra outra reclamação antes
    // da microtarefa rodar), e a limpeza incrementa `requestSeqRef` na
    // hora, invalidando de imediato uma carga desta reclamação que já
    // esteja em voo -- inclusive as sub-consultas de pedido/disputa
    // dentro de `load`, que já conferem o mesmo `requestSeqRef` em cada
    // ponto (ver F3.1).
    let cancelled = false;
    const id = params.id;
    queueMicrotask(() => {
      if (cancelled) return;
      void load(id);
    });
    return () => {
      cancelled = true;
      requestSeqRef.current += 1;
    };
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
      // claims.ts) -- recarregamos o detalhe completo em vez de só
      // anexar a mensagem localmente: a resposta do vendedor também move
      // o status (para CUSTOMER_RESPONSE_REQUIRED), e só o
      // GET .../claims/:id reflete esse novo estado.
      await addMySellerClaimMessage(claim.id, body);
      setMessageBody("");
      await load(claim.id);
    } catch (err) {
      setMessageError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível enviar sua resposta. Tente novamente.",
      );
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function confirmOpenDispute() {
    if (!claim) return;
    setIsSubmittingDispute(true);
    setDisputeActionError(null);
    try {
      await openMySellerClaimDispute(claim.id);
      setIsConfirmingDispute(false);
      await load(claim.id);
    } catch (err) {
      // 409 (status não elegível, ou disputa já aberta) já vem com
      // mensagem pronta do backend -- nunca tratado como sucesso.
      setDisputeActionError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível abrir a disputa. Tente novamente.",
      );
    } finally {
      setIsSubmittingDispute(false);
    }
  }

  function retryLoad() {
    void load(params.id);
  }

  if (isLoading) {
    return <p role="status">Carregando reclamação…</p>;
  }

  if (loadError || !claim) {
    return (
      <section className={styles.denied} role="alert">
        <h1 className={styles.pageTitle}>Reclamação indisponível</h1>
        <p>{loadError ?? "Esta reclamação não pertence à sua loja."}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {loadError ? (
            <button type="button" className={styles.ghostBtn} onClick={retryLoad}>
              Tentar novamente
            </button>
          ) : null}
          <Link href="/loja/pos-venda/reclamacoes" className={styles.rowLink}>
            Voltar à lista
          </Link>
        </div>
      </section>
    );
  }

  const live = isClaimLive(claim.status);

  return (
    <>
      <header>
        <h1 className={styles.pageTitle}>
          Reclamação · {CLAIM_STATUS_LABEL[claim.status]}
        </h1>
        <p className={styles.pageLead}>
          {orderContext
            ? `Pedido ${orderContext.orderNumber} · ${orderContext.productTitle} (${orderContext.sku})`
            : "Motivo: " + claim.reason}
        </p>
      </header>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Detalhes</h2>
        <p>
          Motivo: {claim.reason}
          {claim.description ? (
            <>
              <br />
              {claim.description}
            </>
          ) : null}
        </p>
        <p style={{ color: "var(--seller-muted)" }}>
          Aberta em {formatDateTime(claim.createdAt)}
          {claim.resolvedAt ? ` · Resolvida em ${formatDateTime(claim.resolvedAt)}` : ""}
        </p>
      </section>

      {claim.dispute ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Disputa</h2>
          {isDisputeLoading ? (
            <p role="status">Carregando disputa…</p>
          ) : disputeError ? (
            <div role="alert">
              <p style={{ color: "var(--potala-danger, #c95c57)" }}>{disputeError}</p>
              <button type="button" className={styles.ghostBtn} onClick={retryLoad}>
                Tentar novamente
              </button>
            </div>
          ) : dispute ? (
            <>
              <p>
                Situação: {DISPUTE_STATUS_LABEL[dispute.status]}
                {dispute.outcome ? ` · Resultado: ${DISPUTE_OUTCOME_LABEL[dispute.outcome]}` : ""}
              </p>
              {dispute.decisions.length > 0 ? (
                <ul>
                  {dispute.decisions.map((decision, index) => (
                    <li key={index}>
                      {DISPUTE_OUTCOME_LABEL[decision.outcome]} — {decision.reason} (
                      {formatDateTime(decision.createdAt)})
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: "var(--seller-muted)" }}>
                  Ainda sem decisão administrativa registrada.
                </p>
              )}
            </>
          ) : null}
        </section>
      ) : null}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Mensagens</h2>
        {claim.messages.length === 0 ? (
          <p style={{ color: "var(--seller-muted)" }}>Nenhuma mensagem ainda.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {claim.messages.map((message) => (
              <li
                key={message.id}
                style={{
                  padding: 10,
                  border: "1px solid var(--seller-border)",
                  borderRadius: 10,
                }}
              >
                <strong>{AUTHOR_ROLE_LABEL[message.authorRole]}</strong>
                {" · "}
                <span style={{ color: "var(--seller-muted)", fontSize: "0.85rem" }}>
                  {formatDateTime(message.createdAt)}
                </span>
                <p style={{ margin: "6px 0 0" }}>{message.body}</p>
              </li>
            ))}
          </ul>
        )}

        {claim.evidence.length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "0.9rem" }}>
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
          <form onSubmit={handleSendMessage} className={styles.formGrid} style={{ marginTop: 16 }}>
            <div className={styles.field}>
              <label htmlFor="seller-claim-message">Responder ao cliente</label>
              <textarea
                id="seller-claim-message"
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                maxLength={4000}
                rows={3}
                required
                disabled={isSendingMessage}
              />
            </div>
            {messageError ? (
              <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
                {messageError}
              </p>
            ) : null}
            <button type="submit" className={styles.primaryBtn} disabled={isSendingMessage}>
              {isSendingMessage ? "Enviando…" : "Enviar resposta"}
            </button>
          </form>
        ) : (
          <p style={{ marginTop: 16, color: "var(--seller-muted)" }}>
            Esta reclamação não está mais aberta para novas mensagens.
          </p>
        )}
      </section>

      {live ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Ações</h2>
          <p style={{ color: "var(--seller-muted)" }}>
            Como vendedor, você responde à reclamação acima. Resolver,
            cancelar ou encerrar continua sendo uma decisão do cliente ou
            da equipe Potala -- a única ação disponível aqui é escalar
            para uma disputa formal, se ainda não houver uma aberta.
          </p>
          {disputeActionError ? (
            <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
              {disputeActionError}
            </p>
          ) : null}

          {!claim.dispute ? (
            isConfirmingDispute ? (
              <div style={{ display: "grid", gap: 10 }}>
                <p>
                  Isto abre uma mediação formal com o Instituto Potala.
                  Deseja continuar?
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    disabled={isSubmittingDispute}
                    onClick={() => void confirmOpenDispute()}
                  >
                    {isSubmittingDispute ? "Enviando…" : "Confirmar"}
                  </button>
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    disabled={isSubmittingDispute}
                    onClick={() => setIsConfirmingDispute(false)}
                  >
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => setIsConfirmingDispute(true)}
              >
                Abrir disputa
              </button>
            )
          ) : null}
        </section>
      ) : null}
    </>
  );
}
