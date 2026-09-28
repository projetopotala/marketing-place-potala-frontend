"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RETURN_STATUS_LABEL,
  approveReturn,
  listAdminReturns,
  rejectReturn,
  type ReturnListItemResponse,
  type ReturnStatus,
} from "@/lib/api/returns";
import { ApiError } from "@/lib/api/client";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminDataTable, sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminStatusBadge } from "@/components/admin/shared/AdminStatusBadge";
import { AdminConfirmDialog } from "@/components/admin/shared/AdminModal";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";

const PAGE_SIZE = 10;

/**
 * Real via GET /admin/returns + PATCH /admin/returns/:id/(approve|reject)
 * (orders-service, novo nesta sessão -- pedido de Arthur "vamos seguir em
 * frente", ver claude/status-migracao-microservicos.md no Claude
 * Project). O admin aqui é só o mediador: aprovar/rejeitar não dispara
 * reembolso nem repõe estoque -- ver comentário do model Return no
 * schema.prisma do orders-service pra por que (PaymentTransaction não
 * distingue cobrança de estorno ainda; catalog-service não tem método de
 * repor `quantidade`). Uma decisão já tomada não muda de ideia nesta v1
 * (o backend recusa com 409) -- por isso as ações só aparecem em linhas
 * REQUESTED.
 */
type DecisionAction = "approve" | "reject";

function returnTone(status: ReturnStatus) {
  if (status === "APPROVED") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  return "warning" as const;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

export function ReturnsView() {
  const toast = useAdminToast();
  const [returns, setReturns] = useState<ReturnListItemResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<{
    row: ReturnListItemResponse;
    action: DecisionAction;
  } | null>(null);

  const loadPage = useCallback(async (cursor: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await listAdminReturns({ limit: PAGE_SIZE, cursor });
      setReturns(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setReturns(null);
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar as devoluções.",
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

  function applyResult(id: string, status: ReturnStatus) {
    setReturns((current) =>
      current ? current.map((row) => (row.id === id ? { ...row, status } : row)) : current,
    );
  }

  async function confirmDecision() {
    if (!decisionTarget) return;
    const { row, action } = decisionTarget;
    setPendingActionId(row.id);
    try {
      const result = action === "approve" ? await approveReturn(row.id) : await rejectReturn(row.id);
      applyResult(row.id, result.status);
      toast.push(action === "approve" ? "Devolução aprovada" : "Devolução rejeitada");
      setDecisionTarget(null);
    } catch (err) {
      toast.push(
        err instanceof ApiError ? err.message : "Não foi possível concluir a ação.",
        "error",
      );
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader
        title="Devoluções"
        description="Aprove ou rejeite solicitações de devolução, direto do orders-service."
      />

      {isLoading ? (
        <p role="status">Carregando devoluções…</p>
      ) : error ? (
        <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
          {error}
        </p>
      ) : (
        <AdminDataTable
          caption="Lista de devoluções"
          rows={returns ?? []}
          columns={[
            {
              key: "order",
              header: "Pedido",
              render: (row) => row.orderItem.sellerOrder.order.orderNumber,
            },
            {
              key: "product",
              header: "Produto",
              render: (row) => row.orderItem.productTitle,
            },
            {
              key: "reason",
              header: "Motivo",
              render: (row) => row.reason,
            },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <AdminStatusBadge
                  label={RETURN_STATUS_LABEL[row.status]}
                  tone={returnTone(row.status)}
                />
              ),
            },
            {
              key: "createdAt",
              header: "Solicitado em",
              render: (row) => formatDate(row.createdAt),
            },
            {
              key: "actions",
              header: "Ações",
              render: (row) =>
                row.status === "REQUESTED" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className={sharedStyles.linkBtn}
                      disabled={pendingActionId === row.id}
                      onClick={() => setDecisionTarget({ row, action: "approve" })}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      className={sharedStyles.linkBtn}
                      disabled={pendingActionId === row.id}
                      onClick={() => setDecisionTarget({ row, action: "reject" })}
                    >
                      Rejeitar
                    </button>
                  </div>
                ) : (
                  "—"
                ),
            },
          ]}
          mobileCard={(row) => (
            <>
              <strong>{row.orderItem.productTitle}</strong>
              <span>Pedido {row.orderItem.sellerOrder.order.orderNumber}</span>
              <AdminStatusBadge
                label={RETURN_STATUS_LABEL[row.status]}
                tone={returnTone(row.status)}
              />
              <span>{formatDate(row.createdAt)}</span>
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

      <AdminConfirmDialog
        open={Boolean(decisionTarget)}
        title={decisionTarget?.action === "approve" ? "Aprovar devolução" : "Rejeitar devolução"}
        description={`Confirma ${decisionTarget?.action === "approve" ? "aprovar" : "rejeitar"} a devolução de "${decisionTarget?.row.orderItem.productTitle ?? ""}"? Isto não processa reembolso nem repõe estoque automaticamente.`}
        confirmLabel="Confirmar"
        busy={pendingActionId === decisionTarget?.row.id}
        onConfirm={() => void confirmDecision()}
        onClose={() => setDecisionTarget(null)}
      />
    </div>
  );
}
