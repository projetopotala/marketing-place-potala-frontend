"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api/client";
import {
  DISPUTE_STATUS_LABEL,
  DISPUTE_OUTCOME_LABEL,
  getAdminDispute,
  recordAdminDisputeDecision,
  type AdminDisputeDetailResponse,
  type DisputeOutcome,
  type DisputeStatus,
} from "@/lib/api/disputes";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import {
  AdminStatusBadge,
  AdminEmptyState,
  Field,
} from "@/components/admin/shared/AdminStatusBadge";
import { sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminConfirmDialog } from "@/components/admin/shared/AdminModal";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";
import moduleStyles from "./modules.module.css";

/**
 * Espelha disputes.service.ts (DISPUTE_DECISION_ELIGIBLE_STATUSES) --
 * `recordDecision` só é aceito nestes quatro status; uma vez
 * RESOLVED/CLOSED, o backend rejeita com 409 ("já decidida"). Replicado
 * aqui só para habilitar/desabilitar o formulário com antecedência --
 * o backend continua sendo a autoridade final.
 */
const DISPUTE_DECISION_ELIGIBLE_STATUSES: DisputeStatus[] = [
  "OPEN",
  "UNDER_REVIEW",
  "WAITING_CUSTOMER",
  "WAITING_SELLER",
];

const OUTCOME_OPTIONS: DisputeOutcome[] = [
  "CUSTOMER_FAVORED",
  "SELLER_FAVORED",
  "PARTIAL",
  "NO_ACTION",
];

/**
 * MAX_DISPUTE_DECISION_REASON_LENGTH (orders.constants.ts,
 * potala-orders-service) -- confirmado em 2000 lendo o arquivo real
 * antes de escrever este formulário, não presumido.
 */
const MAX_REASON_LENGTH = 2000;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

/**
 * F4 -- pós-venda do ADMIN (detalhe de disputa). Mesmo padrão de ciclo
 * de vida/corrida já validado em SellerClaimDetailView.tsx (F3.1/F3.2):
 * `load` é um `useCallback` async direto, `requestSeqRef` guarda contra
 * navegação rápida entre disputas e contra desmontagem, disparo do
 * efeito adiado via `queueMicrotask` com cleanup que invalida a carga
 * em voo imediatamente.
 *
 * `recordAdminDisputeDecision` devolve a DisputeDecision criada, não a
 * Dispute (ver AdminDisputeDecisionResponse em disputes.ts) -- por isso,
 * depois de registrar, recarregamos o detalhe completo em vez de só
 * anexar a decisão localmente: só o GET .../disputes/:id reflete o novo
 * status (RESOLVED) e `resolvedAt`.
 */
export function AdminDisputeDetailView({ id }: { id: string }) {
  const toast = useAdminToast();
  const [dispute, setDispute] = useState<AdminDisputeDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // F4.1 -- "" representa "nenhum resultado escolhido ainda"; sem isto,
  // o primeiro valor de OUTCOME_OPTIONS ("NO_ACTION") seria enviado como
  // se fosse uma escolha consciente do admin, sem o admin ter tocado o
  // campo.
  const [outcome, setOutcome] = useState<DisputeOutcome | "">("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{
    outcome: DisputeOutcome;
    reason: string;
  } | null>(null);

  const requestSeqRef = useRef(0);
  // F4.2 -- requestSeqRef é de uso EXCLUSIVO de load() (protege leituras
  // concorrentes entre si). Reaproveitá-lo para confirmRecordDecision()
  // era o defeito: load() incrementa requestSeqRef a cada chamada, então
  // o `finally` de uma decisão que termina em `await load(...)` sempre
  // via requestSeqRef mudado -- mesmo em sucesso, na MESMA disputa -- e
  // nunca limpava isSubmitting. idRef/mountedRef abaixo são os controles
  // independentes: idRef segue a disputa atualmente exibida (muda só por
  // navegação), mountedRef só por desmontagem real -- nenhum dos dois é
  // tocado por load().
  const idRef = useRef(id);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (disputeId: string) => {
    const seq = (requestSeqRef.current += 1);
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await getAdminDispute(disputeId);
      if (requestSeqRef.current !== seq) return;
      setDispute(result);
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      setDispute(null);
      setLoadError(err instanceof ApiError ? err.message : "Disputa não encontrada.");
    } finally {
      if (requestSeqRef.current === seq) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // F4.2 -- atualiza idRef em efeito, nunca durante o render (regra
    // react-hooks/refs): é aqui, não no corpo da função, que a leitura
    // de um ref pode ser escrita com segurança.
    idRef.current = id;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      // F4.1 -- a instância é reaproveitada ao navegar de uma disputa para
      // outra (o `id` muda, o componente não é remontado). Sem isto, a
      // escolha de resultado, o motivo digitado ou um diálogo de
      // confirmação pendentes da disputa anterior ficariam na tela da nova.
      setOutcome("");
      setReason("");
      setSubmitError(null);
      setIsSubmitting(false);
      setPendingDecision(null);
      void load(id);
    });
    return () => {
      cancelled = true;
      requestSeqRef.current += 1;
    };
  }, [id, load]);

  function handleRequestDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !dispute || !outcome) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) return;
    // F4.1 -- não envia direto: abre a confirmação primeiro, porque a
    // decisão é definitiva neste contrato (o backend rejeita qualquer novo
    // envio com 409 depois de decidida).
    setPendingDecision({ outcome, reason: trimmedReason });
  }

  async function confirmRecordDecision() {
    // F4.3 -- guarda extra contra confirmações duplicadas/rápidas: além
    // do botão ficar disabled={isSubmitting} (e, agora, do próprio
    // AlertDialog.Action não fechar o diálogo sozinho -- ver
    // AdminConfirmDialog/controlledClose), esta função também nunca
    // reentra enquanto uma chamada anterior ainda está em voo.
    if (!dispute || !pendingDecision || isSubmitting) return;
    // F4.2 -- fotografa a disputa atual; a validade desta operação de
    // escrita depende só de "ainda estou montado e ainda é esta disputa"
    // (idRef/mountedRef), nunca do contador de load() -- assim um
    // `await load(disputeId)` bem-sucedido abaixo não invalida a própria
    // finalização desta função.
    const disputeId = dispute.id;
    const stillRelevant = () => mountedRef.current && idRef.current === disputeId;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await recordAdminDisputeDecision(disputeId, pendingDecision);
      toast.push("Decisão registrada");
      if (!stillRelevant()) return; // navegou para outra disputa ou desmontou -- não reaplica
      setPendingDecision(null);
      setReason("");
      setOutcome("");
      await load(disputeId);
    } catch (err) {
      if (!stillRelevant()) return;
      // 409 (disputa já decidida) já vem com mensagem pronta do backend
      // -- nunca tratado como sucesso.
      setSubmitError(
        err instanceof ApiError ? err.message : "Não foi possível registrar a decisão.",
      );
    } finally {
      // F4.2 -- sempre libera o indicador desta escrita quando ainda
      // relevante, mesmo depois de load() ter avançado requestSeqRef.
      if (stillRelevant()) setIsSubmitting(false);
    }
  }

  function retryLoad() {
    void load(id);
  }

  if (isLoading) {
    return <div className={sharedStyles.skeleton} aria-busy="true" />;
  }

  if (loadError || !dispute) {
    return (
      <div className={sharedStyles.stack}>
        <AdminEmptyState title="Disputa não encontrada" description={loadError ?? undefined} />
        <div style={{ display: "flex", gap: 8 }}>
          {loadError ? (
            <button type="button" className={sharedStyles.btnGhost} onClick={retryLoad}>
              Tentar novamente
            </button>
          ) : null}
          <Link href="/admin/pos-venda/disputas" className={sharedStyles.btnGhost}>
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const canDecide = DISPUTE_DECISION_ELIGIBLE_STATUSES.includes(dispute.status);

  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader
        title={`Disputa · ${DISPUTE_STATUS_LABEL[dispute.status]}`}
        description={
          dispute.claimId
            ? "Origem: reclamação"
            : dispute.returnId
              ? "Origem: devolução"
              : undefined
        }
        actions={
          <Link href="/admin/pos-venda/disputas" className={sharedStyles.btnGhost}>
            Voltar
          </Link>
        }
      />

      <div className={sharedStyles.panel}>
        <h2 className={sharedStyles.panelTitle}>Detalhes</h2>
        <div className={moduleStyles.kvGrid}>
          <div>
            <p className={moduleStyles.kvLabel}>Status</p>
            <AdminStatusBadge label={DISPUTE_STATUS_LABEL[dispute.status]} />
          </div>
          <div>
            <p className={moduleStyles.kvLabel}>Resultado</p>
            <p className={moduleStyles.kvValue}>
              {dispute.outcome ? DISPUTE_OUTCOME_LABEL[dispute.outcome] : "Ainda sem decisão"}
            </p>
          </div>
          <div>
            <p className={moduleStyles.kvLabel}>Origem</p>
            <p className={moduleStyles.kvValue}>
              {dispute.claimId ? (
                <Link
                  href={`/admin/pos-venda/reclamacoes/${dispute.claimId}`}
                  className={sharedStyles.linkBtn}
                >
                  Ver reclamação de origem
                </Link>
              ) : dispute.returnId ? (
                // Não existe GET /admin/returns/:id (detalhe individual) --
                // só a listagem em /admin/devolucoes, confirmado no
                // diagnóstico (seção 3). Por isso aqui é texto, não link.
                `Devolução #${dispute.returnId.slice(0, 8)} (ver em Devoluções)`
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p className={moduleStyles.kvLabel}>Aberta em</p>
            <p className={moduleStyles.kvValue}>{formatDateTime(dispute.openedAt)}</p>
          </div>
          {dispute.resolvedAt ? (
            <div>
              <p className={moduleStyles.kvLabel}>Resolvida em</p>
              <p className={moduleStyles.kvValue}>{formatDateTime(dispute.resolvedAt)}</p>
            </div>
          ) : null}
          {dispute.closedAt ? (
            <div>
              <p className={moduleStyles.kvLabel}>Encerrada em</p>
              <p className={moduleStyles.kvValue}>{formatDateTime(dispute.closedAt)}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className={sharedStyles.panel}>
        <h2 className={sharedStyles.panelTitle}>Decisões</h2>
        {dispute.decisions.length === 0 ? (
          <p className={moduleStyles.muted}>Ainda sem decisão administrativa registrada.</p>
        ) : (
          <ul className={moduleStyles.timeline}>
            {dispute.decisions.map((decision) => (
              <li key={decision.id} className={moduleStyles.timelineItem}>
                <p className={moduleStyles.timelineAt}>{formatDateTime(decision.createdAt)}</p>
                <p className={moduleStyles.timelineLabel}>
                  {DISPUTE_OUTCOME_LABEL[decision.outcome]}
                </p>
                <p className={moduleStyles.timelineDetail}>{decision.reason}</p>
                {/* F4.1 -- rastreabilidade discreta: decidedByUserId existe em
                    AdminDisputeDecisionResponse (confirmado em disputes.ts),
                    nunca exposto a customer/seller. Sem consulta adicional a
                    nenhum serviço, sem inventar nome -- só o identificador
                    que a própria API já devolve. */}
                <p className={moduleStyles.timelineDetail}>
                  Decidido por: admin {decision.decidedByUserId.slice(0, 8)}
                </p>
              </li>
            ))}
          </ul>
        )}

        {canDecide ? (
          <form
            onSubmit={handleRequestDecision}
            className={sharedStyles.stack}
            style={{ marginTop: 16 }}
          >
            <Field label="Resultado">
              <select
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as DisputeOutcome | "")}
                disabled={isSubmitting}
              >
                <option value="" disabled>
                  Selecione um resultado…
                </option>
                {OUTCOME_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {DISPUTE_OUTCOME_LABEL[value]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Motivo">
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={MAX_REASON_LENGTH}
                rows={3}
                required
                disabled={isSubmitting}
              />
            </Field>
            {submitError ? (
              <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
                {submitError}
              </p>
            ) : null}
            <button
              type="submit"
              className={sharedStyles.btn}
              disabled={isSubmitting || !outcome || !reason.trim()}
            >
              {isSubmitting ? "Registrando…" : "Registrar decisão"}
            </button>
          </form>
        ) : (
          <p className={moduleStyles.muted} style={{ marginTop: 16 }}>
            Esta disputa já foi decidida e não aceita mais decisões.
          </p>
        )}
      </div>

      <AdminConfirmDialog
        open={pendingDecision !== null}
        title="Registrar decisão definitiva"
        description={
          pendingDecision
            ? `Resultado: ${DISPUTE_OUTCOME_LABEL[pendingDecision.outcome]}. Esta decisão é definitiva neste contrato -- a disputa não aceitará novo registro depois de confirmada. Deseja continuar?`
            : ""
        }
        confirmLabel="Confirmar decisão"
        busy={isSubmitting}
        onConfirm={() => void confirmRecordDecision()}
        onClose={() => setPendingDecision(null)}
        // F4.3 -- AlertDialog.Action (Radix) fecha o diálogo sozinho de
        // forma síncrona ao clicar, antes da requisição a
        // recordAdminDisputeDecision terminar. controlledClose devolve o
        // controle de fechamento só para confirmRecordDecision() (fecha
        // em sucesso via setPendingDecision(null), permanece aberto em
        // erro) e mostra o erro dentro do próprio diálogo em vez de
        // atrás do backdrop.
        controlledClose
        error={submitError}
      />
    </div>
  );
}
