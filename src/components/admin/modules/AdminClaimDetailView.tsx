"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api/client";
import {
  CLAIM_STATUS_LABEL,
  getAdminClaim,
  addAdminClaimMessage,
  escalateAdminClaim,
  resolveAdminClaim,
  closeAdminClaim,
  type ClaimAuthorRole,
  type ClaimDetailResponse,
  type ClaimStatus,
} from "@/lib/api/claims";
import { openAdminClaimDispute } from "@/lib/api/disputes";
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
 * Espelha claims.service.ts (potala-orders-service) -- lido diretamente
 * antes de desenhar os botões, não presumido (ver claude/relatorio-f4-
 * diagnostico-pos-venda-administrativo.md, seção 4):
 * - CLAIM_TRANSITIONS: máquina de estados estrutural.
 * - CLAIM_ROLE_TARGETS[Role.ADMIN] = [ESCALATED, CLOSED, RESOLVED].
 * Um botão de ação só aparece quando o alvo está nas DUAS tabelas a
 * partir do status atual -- a interseção, replicada abaixo, nunca só
 * uma das duas isoladamente (o backend é a autoridade final mesmo
 * assim: qualquer tentativa que escape disto aqui ainda recebe 409).
 */
const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  OPEN: ["SELLER_RESPONSE_REQUIRED", "CUSTOMER_RESPONSE_REQUIRED", "RESOLVED", "ESCALATED", "CANCELLED"],
  SELLER_RESPONSE_REQUIRED: ["CUSTOMER_RESPONSE_REQUIRED", "RESOLVED", "ESCALATED", "CANCELLED"],
  CUSTOMER_RESPONSE_REQUIRED: ["SELLER_RESPONSE_REQUIRED", "RESOLVED", "ESCALATED", "CANCELLED"],
  RESOLVED: ["CLOSED"],
  ESCALATED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

type AdminActionTarget = "ESCALATED" | "RESOLVED" | "CLOSED";

const ADMIN_ROLE_TARGETS: readonly AdminActionTarget[] = ["ESCALATED", "CLOSED", "RESOLVED"];

function adminAllowedTargets(status: ClaimStatus): AdminActionTarget[] {
  const structural = CLAIM_TRANSITIONS[status] ?? [];
  return structural.filter((target): target is AdminActionTarget =>
    (ADMIN_ROLE_TARGETS as readonly ClaimStatus[]).includes(target),
  );
}

/**
 * Mesmas três fases "em conversa" de claims.service.ts
 * (CLAIM_STATUSES_OPEN_FOR_INPUT) -- aceitam mensagem nova do admin (que,
 * diferente de customer/seller, NÃO move o status automaticamente) e são
 * elegíveis pra abrir disputa (CLAIM_ORIGIN_ELIGIBLE_STATUSES,
 * disputes.service.ts -- mesmos três valores exatos).
 */
const CLAIM_LIVE_STATUSES: ClaimStatus[] = [
  "OPEN",
  "SELLER_RESPONSE_REQUIRED",
  "CUSTOMER_RESPONSE_REQUIRED",
];

function isClaimLive(status: ClaimStatus): boolean {
  return CLAIM_LIVE_STATUSES.includes(status);
}

const AUTHOR_ROLE_LABEL: Record<ClaimAuthorRole, string> = {
  CUSTOMER: "Cliente",
  SELLER: "Vendedor",
  ADMIN: "Você (equipe Potala)",
};

const ACTION_LABEL: Record<"ESCALATED" | "RESOLVED" | "CLOSED", string> = {
  ESCALATED: "Escalar",
  RESOLVED: "Resolver",
  CLOSED: "Encerrar",
};

type PendingAction = "ESCALATED" | "RESOLVED" | "CLOSED" | "DISPUTE";

const DIALOG_COPY: Record<PendingAction, { title: string; description: string }> = {
  ESCALATED: {
    title: "Escalar reclamação",
    description: "A reclamação passa para ESCALADA. Deseja continuar?",
  },
  RESOLVED: {
    title: "Resolver reclamação",
    description: "A reclamação será marcada como RESOLVIDA. Deseja continuar?",
  },
  CLOSED: {
    title: "Encerrar reclamação",
    description: "A reclamação será ENCERRADA definitivamente. Deseja continuar?",
  },
  DISPUTE: {
    title: "Abrir disputa",
    description:
      "Isto abre uma mediação formal a partir desta reclamação. Deseja continuar?",
  },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * F4 -- pós-venda do ADMIN (detalhe de reclamação). Mesmo padrão de
 * ciclo de vida/corrida já validado em SellerClaimDetailView.tsx
 * (F3.1/F3.2): `load` é um `useCallback` async direto (nunca um wrapper
 * só pra esconder o aviso do ESLint), `requestSeqRef` guarda contra
 * navegação rápida entre reclamações e contra desmontagem, e o disparo
 * do efeito é adiado via `queueMicrotask`, com cleanup que marca
 * `cancelled` e invalida a carga em voo imediatamente.
 *
 * Evidência: só leitura (metadados já anexados) -- sem formulário de
 * anexar evidência aqui, mesma decisão já tomada em
 * SellerClaimDetailView.tsx (que também não oferece essa ação, apesar
 * de o client ter `addAdminClaimEvidence`/`addMySellerClaimEvidence`
 * disponíveis): a API real só aceita metadados (sem upload de fato), e
 * construir um formulário de "anexar arquivo" aqui seria simular um
 * upload que não existe -- exatamente o que esta rodada pediu para não
 * fazer.
 */
export function AdminClaimDetailView({ id }: { id: string }) {
  const toast = useAdminToast();
  const [claim, setClaim] = useState<ClaimDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [messageBody, setMessageBody] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const requestSeqRef = useRef(0);
  // F4.2 -- requestSeqRef é de uso EXCLUSIVO de load() (protege leituras
  // concorrentes entre si). Reaproveitá-lo para as operações de escrita
  // era o defeito: load() incrementa requestSeqRef a cada chamada, então
  // o `finally` de uma escrita que termina em `await load(...)` sempre
  // via requestSeqRef mudado -- mesmo em sucesso, na MESMA reclamação --
  // e nunca limpava isSendingMessage/isSubmittingAction. idRef/mountedRef
  // abaixo são os controles independentes para o ciclo de vida das
  // escritas: idRef segue a reclamação atualmente exibida (muda só por
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

  const load = useCallback(async (claimId: string) => {
    const seq = (requestSeqRef.current += 1);
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await getAdminClaim(claimId);
      if (requestSeqRef.current !== seq) return; // navegou pra outra reclamação -- descarta
      setClaim(result);
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      setClaim(null);
      setLoadError(err instanceof ApiError ? err.message : "Reclamação não encontrada.");
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
      // F4.1 -- a instância é reaproveitada ao navegar de uma reclamação
      // para outra (o `id` muda, o componente não é remontado). Sem isto,
      // rascunho de mensagem, erro ou diálogo de confirmação da
      // reclamação anterior ficariam visíveis na nova.
      setMessageBody("");
      setMessageError(null);
      setPendingAction(null);
      setActionError(null);
      setIsSendingMessage(false);
      setIsSubmittingAction(false);
      void load(id);
    });
    return () => {
      cancelled = true;
      requestSeqRef.current += 1;
    };
  }, [id, load]);

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSendingMessage || !claim) return;
    const body = messageBody.trim();
    if (!body) return;
    // F4.2 -- fotografa a reclamação atual; a validade desta operação de
    // escrita depende só de "ainda estou montado e ainda é esta
    // reclamação" (idRef/mountedRef), nunca do contador de load() --
    // assim um `await load(claimId)` bem-sucedido abaixo não invalida a
    // própria finalização desta função.
    const claimId = claim.id;
    const stillRelevant = () => mountedRef.current && idRef.current === claimId;
    setIsSendingMessage(true);
    setMessageError(null);
    try {
      // Backend devolve a ClaimMessage criada, não a Claim (ver
      // claims.ts) -- recarregamos o detalhe completo em vez de só
      // anexar a mensagem localmente.
      await addAdminClaimMessage(claimId, body);
      // A mensagem foi enviada com sucesso independentemente de para onde
      // o admin navegou -- a notificação é global, não presa à tela atual.
      toast.push("Mensagem enviada");
      if (!stillRelevant()) return; // navegou para outra reclamação ou desmontou -- não reaplica
      setMessageBody("");
      await load(claimId);
    } catch (err) {
      if (!stillRelevant()) return; // erro de A não aparece na tela de B
      setMessageError(
        err instanceof ApiError ? err.message : "Não foi possível enviar a mensagem.",
      );
    } finally {
      // F4.2 -- sempre libera o indicador desta escrita quando ainda
      // relevante, mesmo depois de load() ter avançado requestSeqRef.
      if (stillRelevant()) setIsSendingMessage(false);
    }
  }

  async function confirmAction() {
    // F4.3 -- guarda extra contra confirmações duplicadas/rápidas: além
    // do botão ficar disabled={isSubmittingAction} (e, agora, do próprio
    // AlertDialog.Action não fechar o diálogo sozinho -- ver
    // AdminConfirmDialog/controlledClose), esta função também nunca
    // reentra enquanto uma chamada anterior ainda está em voo.
    if (!claim || !pendingAction || isSubmittingAction) return;
    // F4.2 -- mesmo princípio de handleSendMessage: a validade desta
    // transição depende só de idRef/mountedRef, nunca do contador de
    // load() -- caso contrário o `await load(claimId)` de sucesso abaixo
    // sempre invalidaria a própria finalização desta função.
    const claimId = claim.id;
    const action = pendingAction;
    const stillRelevant = () => mountedRef.current && idRef.current === claimId;
    setIsSubmittingAction(true);
    setActionError(null);
    try {
      if (action === "DISPUTE") {
        await openAdminClaimDispute(claimId);
        toast.push("Disputa aberta");
      } else if (action === "ESCALATED") {
        await escalateAdminClaim(claimId);
        toast.push("Reclamação escalada");
      } else if (action === "RESOLVED") {
        await resolveAdminClaim(claimId);
        toast.push("Reclamação resolvida");
      } else {
        await closeAdminClaim(claimId);
        toast.push("Reclamação encerrada");
      }
      // 409 (status não elegível, ou disputa já aberta) já vem com
      // mensagem pronta do backend -- nunca tratado como sucesso: só
      // chegamos aqui se a chamada de fato resolveu sem erro.
      if (!stillRelevant()) return; // navegou para outra reclamação ou desmontou -- não reaplica
      setPendingAction(null);
      await load(claimId);
    } catch (err) {
      if (!stillRelevant()) return;
      setActionError(
        err instanceof ApiError ? err.message : "Não foi possível concluir a ação.",
      );
    } finally {
      // F4.2 -- sempre libera o indicador desta ação quando ainda
      // relevante, mesmo depois de load() ter avançado requestSeqRef.
      if (stillRelevant()) setIsSubmittingAction(false);
    }
  }

  function retryLoad() {
    void load(id);
  }

  if (isLoading) {
    return <div className={sharedStyles.skeleton} aria-busy="true" />;
  }

  if (loadError || !claim) {
    return (
      <div className={sharedStyles.stack}>
        <AdminEmptyState
          title="Reclamação não encontrada"
          description={loadError ?? undefined}
        />
        <div style={{ display: "flex", gap: 8 }}>
          {loadError ? (
            <button type="button" className={sharedStyles.btnGhost} onClick={retryLoad}>
              Tentar novamente
            </button>
          ) : null}
          <Link href="/admin/pos-venda/reclamacoes" className={sharedStyles.btnGhost}>
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const live = isClaimLive(claim.status);
  const allowedTargets = adminAllowedTargets(claim.status);
  const canOpenDispute = live && !claim.dispute;

  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader
        title={`Reclamação · ${CLAIM_STATUS_LABEL[claim.status]}`}
        description={`Motivo: ${claim.reason}`}
        actions={
          <Link href="/admin/pos-venda/reclamacoes" className={sharedStyles.btnGhost}>
            Voltar
          </Link>
        }
      />

      <div className={sharedStyles.panel}>
        <h2 className={sharedStyles.panelTitle}>Detalhes</h2>
        <div className={moduleStyles.kvGrid}>
          <div>
            <p className={moduleStyles.kvLabel}>Status</p>
            <AdminStatusBadge label={CLAIM_STATUS_LABEL[claim.status]} />
          </div>
          <div>
            <p className={moduleStyles.kvLabel}>Motivo</p>
            <p className={moduleStyles.kvValue}>{claim.reason}</p>
          </div>
          {claim.description ? (
            <div>
              <p className={moduleStyles.kvLabel}>Descrição</p>
              <p className={moduleStyles.kvValue}>{claim.description}</p>
            </div>
          ) : null}
          <div>
            <p className={moduleStyles.kvLabel}>Aberta em</p>
            <p className={moduleStyles.kvValue}>{formatDateTime(claim.createdAt)}</p>
          </div>
          {claim.resolvedAt ? (
            <div>
              <p className={moduleStyles.kvLabel}>Resolvida em</p>
              <p className={moduleStyles.kvValue}>{formatDateTime(claim.resolvedAt)}</p>
            </div>
          ) : null}
        </div>
      </div>

      {claim.dispute ? (
        <div className={sharedStyles.panel}>
          <h2 className={sharedStyles.panelTitle}>Disputa</h2>
          <p>
            Esta reclamação já tem uma disputa aberta.{" "}
            <Link
              href={`/admin/pos-venda/disputas/${claim.dispute.id}`}
              className={sharedStyles.linkBtn}
            >
              Ver disputa
            </Link>
          </p>
        </div>
      ) : null}

      <div className={sharedStyles.panel}>
        <h2 className={sharedStyles.panelTitle}>Mensagens</h2>
        {claim.messages.length === 0 ? (
          <p className={moduleStyles.muted}>Nenhuma mensagem ainda.</p>
        ) : (
          <ul className={moduleStyles.timeline}>
            {claim.messages.map((message) => (
              <li key={message.id} className={moduleStyles.timelineItem}>
                <p className={moduleStyles.timelineAt}>{formatDateTime(message.createdAt)}</p>
                <p className={moduleStyles.timelineLabel}>
                  {AUTHOR_ROLE_LABEL[message.authorRole]}
                </p>
                <p className={moduleStyles.timelineDetail}>{message.body}</p>
              </li>
            ))}
          </ul>
        )}

        {claim.evidence.length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "0.9rem" }}>Evidências anexadas</h3>
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
          <form onSubmit={handleSendMessage} className={sharedStyles.stack} style={{ marginTop: 16 }}>
            <Field label="Responder">
              <textarea
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                maxLength={4000}
                rows={3}
                required
                disabled={isSendingMessage}
              />
            </Field>
            {messageError ? (
              <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
                {messageError}
              </p>
            ) : null}
            <button type="submit" className={sharedStyles.btn} disabled={isSendingMessage}>
              {isSendingMessage ? "Enviando…" : "Enviar mensagem"}
            </button>
          </form>
        ) : (
          <p className={moduleStyles.muted} style={{ marginTop: 16 }}>
            Esta reclamação não está mais aberta para novas mensagens.
          </p>
        )}
      </div>

      {allowedTargets.length > 0 || canOpenDispute ? (
        <div className={sharedStyles.panel}>
          <h2 className={sharedStyles.panelTitle}>Ações administrativas</h2>
          {actionError ? (
            <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
              {actionError}
            </p>
          ) : null}
          <div className={sharedStyles.rowActions}>
            {allowedTargets.map((target) => (
              <button
                key={target}
                type="button"
                className={sharedStyles.btnSecondary}
                onClick={() => setPendingAction(target)}
              >
                {ACTION_LABEL[target]}
              </button>
            ))}
            {canOpenDispute ? (
              <button
                type="button"
                className={sharedStyles.btnGhost}
                onClick={() => setPendingAction("DISPUTE")}
              >
                Abrir disputa
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <AdminConfirmDialog
        open={pendingAction !== null}
        title={pendingAction ? DIALOG_COPY[pendingAction].title : ""}
        description={pendingAction ? DIALOG_COPY[pendingAction].description : ""}
        confirmLabel="Confirmar"
        busy={isSubmittingAction}
        onConfirm={() => void confirmAction()}
        onClose={() => setPendingAction(null)}
        // F4.3 -- AlertDialog.Action (Radix) fecha o diálogo sozinho de
        // forma síncrona ao clicar, antes da requisição a
        // escalateAdminClaim/resolveAdminClaim/closeAdminClaim/
        // openAdminClaimDispute terminar. controlledClose devolve o
        // controle de fechamento só para confirmAction() (fecha em
        // sucesso via setPendingAction(null), permanece aberto em erro)
        // e mostra o erro dentro do próprio diálogo em vez de atrás do
        // backdrop.
        controlledClose
        error={actionError}
      />
    </div>
  );
}
