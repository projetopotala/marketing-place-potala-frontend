"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CLAIM_STATUS_LABEL, listAdminClaims, type ClaimResponse } from "@/lib/api/claims";
import {
  DISPUTE_STATUS_LABEL,
  listAdminDisputes,
  type DisputeResponse,
} from "@/lib/api/disputes";
import { ApiError } from "@/lib/api/client";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminStatusBadge } from "@/components/admin/shared/AdminStatusBadge";

/** Só uma amostra curta pra prévia do painel -- a lista completa, paginada, mora nas telas dedicadas. */
const PREVIEW_SIZE = 5;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function disputeOriginLabel(row: DisputeResponse): string {
  if (row.claimId) return `Reclamação #${row.claimId.slice(0, 8)}`;
  if (row.returnId) return `Devolução #${row.returnId.slice(0, 8)}`;
  return "—";
}

/**
 * F4 -- hub de pós-venda do ADMIN. Mesmo raciocínio de
 * SellerPostSaleHubView.tsx: deliberadamente SEM nenhum número
 * agregado/KPI ("X reclamações pendentes") -- nem `GET /admin/claims`
 * nem `GET /admin/disputes` expõem uma contagem total (`PaginationQueryDto`
 * só devolve `items` + `pageInfo.hasNextPage`, nunca um total, confirmado
 * em claims.service.ts/disputes.service.ts) -- ver
 * claude/relatorio-f4-diagnostico-pos-venda-administrativo.md, seção 9.
 * Em vez disso, cada seção mostra só as ocorrências mais recentes (uma
 * chamada real, de uma página só) com link pra lista completa, paginada
 * de verdade.
 *
 * Diferente do hub do vendedor: aqui HÁ uma listagem real de disputas
 * (GET /admin/disputes, exclusiva do ADMIN -- SELLER/CUSTOMER não têm
 * isso), então a prévia de disputas é uma chamada real, não um texto
 * explicativo. Devoluções não tem prévia aqui -- só um link pra
 * /admin/devolucoes (ReturnsView.tsx, já existente e completo para o
 * que admin/returns oferece, fora de escopo de alteração nesta rodada).
 *
 * Duas seções independentes -- cada uma com seu próprio par (cancelled +
 * *SeqRef), nenhuma sequência global compartilhada: a falha/cleanup de
 * uma nunca invalida a outra (mesmo raciocínio de
 * SellerPostSaleHubView.tsx, F3.2).
 */
export function AdminPostSaleHubView() {
  const [claims, setClaims] = useState<ClaimResponse[] | null>(null);
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [isClaimsLoading, setIsClaimsLoading] = useState(true);
  const claimsSeqRef = useRef(0);

  const [disputes, setDisputes] = useState<DisputeResponse[] | null>(null);
  const [disputesError, setDisputesError] = useState<string | null>(null);
  const [isDisputesLoading, setIsDisputesLoading] = useState(true);
  const disputesSeqRef = useRef(0);

  const loadClaims = useCallback(async () => {
    const seq = (claimsSeqRef.current += 1);
    setIsClaimsLoading(true);
    setClaimsError(null);
    try {
      const page = await listAdminClaims({ limit: PREVIEW_SIZE });
      if (claimsSeqRef.current !== seq) return;
      setClaims(page.items);
    } catch (err) {
      if (claimsSeqRef.current !== seq) return;
      setClaims(null);
      setClaimsError(
        err instanceof ApiError ? err.message : "Não foi possível carregar as reclamações.",
      );
    } finally {
      if (claimsSeqRef.current === seq) setIsClaimsLoading(false);
    }
  }, []);

  const loadDisputes = useCallback(async () => {
    const seq = (disputesSeqRef.current += 1);
    setIsDisputesLoading(true);
    setDisputesError(null);
    try {
      const page = await listAdminDisputes({ limit: PREVIEW_SIZE });
      if (disputesSeqRef.current !== seq) return;
      setDisputes(page.items);
    } catch (err) {
      if (disputesSeqRef.current !== seq) return;
      setDisputes(null);
      setDisputesError(
        err instanceof ApiError ? err.message : "Não foi possível carregar as disputas.",
      );
    } finally {
      if (disputesSeqRef.current === seq) setIsDisputesLoading(false);
    }
  }, []);

  useEffect(() => {
    let claimsCancelled = false;
    let disputesCancelled = false;
    queueMicrotask(() => {
      if (claimsCancelled) return;
      void loadClaims();
    });
    queueMicrotask(() => {
      if (disputesCancelled) return;
      void loadDisputes();
    });
    return () => {
      claimsCancelled = true;
      disputesCancelled = true;
      claimsSeqRef.current += 1;
      disputesSeqRef.current += 1;
    };
  }, [loadClaims, loadDisputes]);

  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader
        title="Pós-venda"
        description="Reclamações, disputas e devoluções do marketplace, de qualquer loja."
      />

      <div className={sharedStyles.panel}>
        <h2 className={sharedStyles.panelTitle}>Reclamações mais recentes</h2>
        {isClaimsLoading ? (
          <p role="status">Carregando…</p>
        ) : claimsError ? (
          <div role="alert" className={sharedStyles.stack}>
            <p style={{ color: "var(--potala-danger, #c95c57)" }}>{claimsError}</p>
            <button
              type="button"
              className={sharedStyles.btnGhost}
              onClick={() => void loadClaims()}
            >
              Tentar novamente
            </button>
          </div>
        ) : !claims || claims.length === 0 ? (
          <p>Nenhuma reclamação registrada ainda.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {claims.map((claim) => (
              <li key={claim.id}>
                <Link
                  href={`/admin/pos-venda/reclamacoes/${claim.id}`}
                  className={sharedStyles.linkBtn}
                >
                  <AdminStatusBadge label={CLAIM_STATUS_LABEL[claim.status]} />{" "}
                  {claim.reason} · {formatDate(claim.createdAt)}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p style={{ marginTop: 12 }}>
          <Link href="/admin/pos-venda/reclamacoes" className={sharedStyles.linkBtn}>
            Ver todas as reclamações
          </Link>
        </p>
      </div>

      <div className={sharedStyles.panel}>
        <h2 className={sharedStyles.panelTitle}>Disputas mais recentes</h2>
        {isDisputesLoading ? (
          <p role="status">Carregando…</p>
        ) : disputesError ? (
          <div role="alert" className={sharedStyles.stack}>
            <p style={{ color: "var(--potala-danger, #c95c57)" }}>{disputesError}</p>
            <button
              type="button"
              className={sharedStyles.btnGhost}
              onClick={() => void loadDisputes()}
            >
              Tentar novamente
            </button>
          </div>
        ) : !disputes || disputes.length === 0 ? (
          <p>Nenhuma disputa registrada ainda.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {disputes.map((dispute) => (
              <li key={dispute.id}>
                <Link
                  href={`/admin/pos-venda/disputas/${dispute.id}`}
                  className={sharedStyles.linkBtn}
                >
                  <AdminStatusBadge label={DISPUTE_STATUS_LABEL[dispute.status]} />{" "}
                  {disputeOriginLabel(dispute)} · {formatDate(dispute.openedAt)}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p style={{ marginTop: 12 }}>
          <Link href="/admin/pos-venda/disputas" className={sharedStyles.linkBtn}>
            Ver todas as disputas
          </Link>
        </p>
      </div>

      <div className={sharedStyles.panel}>
        <h2 className={sharedStyles.panelTitle}>Devoluções</h2>
        <p>
          Aprovação e rejeição de solicitações de devolução continuam na
          tela dedicada, sem mudanças nesta rodada.
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/admin/devolucoes" className={sharedStyles.linkBtn}>
            Ir para Devoluções
          </Link>
        </p>
      </div>
    </div>
  );
}
