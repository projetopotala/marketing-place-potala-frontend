"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_SELLER_STATUS_LABEL,
  approveSeller,
  listAdminSellers,
  rejectSeller,
  suspendSeller,
  type AdminSeller,
  type AdminSellerStatus,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminDataTable, sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminStatusBadge } from "@/components/admin/shared/AdminStatusBadge";
import { AdminModal, AdminConfirmDialog } from "@/components/admin/shared/AdminModal";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";

const PAGE_SIZE = 10;

function sellerTone(status: AdminSellerStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "PENDING") return "warning" as const;
  if (status === "SUSPENDED") return "danger" as const;
  return "muted" as const;
}

function formatCommission(bps: number | null): string {
  if (bps == null) return "—";
  return `${(bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

type ReasonAction = { type: "reject" | "suspend"; seller: AdminSeller };

/**
 * Lista real via GET /admin/sellers (sellers-service, através do gateway).
 * Sem busca nem filtro por status — o backend só pagina por cursor
 * (PaginationQueryDto: limit/cursor), igual ao painel de produtos do
 * vendedor; achar pendentes específicos hoje significa passar as páginas.
 * Sem tela de detalhe: não existe GET /admin/sellers/:id nem endpoint de
 * produtos/pedidos por vendedor pro admin — decisão explícita de escopo,
 * ver claude/status-migracao-microservicos.md no projeto.
 */
export function SellersView() {
  const toast = useAdminToast();
  const [sellers, setSellers] = useState<AdminSeller[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reasonText, setReasonText] = useState("");

  const loadPage = useCallback(async (cursor: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await listAdminSellers({ limit: PAGE_SIZE, cursor });
      setSellers(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setSellers(null);
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar os vendedores.",
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
    if (!hasNextPage || !sellers || sellers.length === 0) return;
    const nextCursor = sellers[sellers.length - 1]?.id ?? null;
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

  function applyResult(id: string, patch: Partial<AdminSeller>) {
    setSellers((current) =>
      current ? current.map((s) => (s.id === id ? { ...s, ...patch } : s)) : current,
    );
  }

  async function handleApprove(seller: AdminSeller) {
    setPendingActionId(seller.id);
    try {
      const result = await approveSeller(seller.id);
      applyResult(seller.id, result);
      toast.push(`${seller.tradeName} aprovada`);
    } catch (err) {
      toast.push(
        err instanceof ApiError ? err.message : "Não foi possível aprovar.",
        "error",
      );
    } finally {
      setPendingActionId(null);
    }
  }

  async function confirmReasonAction() {
    if (!reasonAction) return;
    const { type, seller } = reasonAction;
    setPendingActionId(seller.id);
    try {
      const result =
        type === "reject"
          ? await rejectSeller(seller.id, reasonText)
          : await suspendSeller(seller.id, reasonText);
      applyResult(seller.id, result);
      toast.push(type === "reject" ? `${seller.tradeName} rejeitada` : `${seller.tradeName} suspensa`);
      setReasonAction(null);
      setReasonText("");
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
        title="Vendedores"
        description="Aprove, rejeite ou suspenda lojas, direto do sellers-service."
      />

      {isLoading ? (
        <p role="status">Carregando vendedores…</p>
      ) : error ? (
        <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
          {error}
        </p>
      ) : (
        <AdminDataTable
          caption="Lista de vendedores"
          rows={sellers ?? []}
          columns={[
            {
              key: "tradeName",
              header: "Loja",
              render: (row) => row.tradeName,
            },
            { key: "email", header: "E-mail", render: (row) => row.email },
            {
              key: "document",
              header: "Documento",
              render: (row) => `${row.documentType} ${row.documentNumber}`,
            },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <AdminStatusBadge
                  label={ADMIN_SELLER_STATUS_LABEL[row.status]}
                  tone={sellerTone(row.status)}
                />
              ),
            },
            {
              key: "commission",
              header: "Comissão",
              render: (row) => formatCommission(row.commissionBps),
            },
            {
              key: "createdAt",
              header: "Criado em",
              render: (row) => formatDate(row.createdAt),
            },
            {
              key: "actions",
              header: "Ações",
              render: (row) => (
                <div className={sharedStyles.rowActions}>
                  {row.status === "PENDING" ? (
                    <>
                      <button
                        type="button"
                        className={sharedStyles.linkBtn}
                        disabled={pendingActionId === row.id}
                        onClick={() => void handleApprove(row)}
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className={sharedStyles.linkBtn}
                        disabled={pendingActionId === row.id}
                        onClick={() => {
                          setReasonText("");
                          setReasonAction({ type: "reject", seller: row });
                        }}
                      >
                        Rejeitar
                      </button>
                    </>
                  ) : null}
                  {row.status === "ACTIVE" ? (
                    <button
                      type="button"
                      className={sharedStyles.linkBtn}
                      disabled={pendingActionId === row.id}
                      onClick={() => {
                        setReasonText("");
                        setReasonAction({ type: "suspend", seller: row });
                      }}
                    >
                      Suspender
                    </button>
                  ) : null}
                  {row.status === "SUSPENDED" || row.status === "REJECTED" ? (
                    <button
                      type="button"
                      className={sharedStyles.linkBtn}
                      disabled={pendingActionId === row.id}
                      onClick={() => void handleApprove(row)}
                    >
                      Reativar
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
          mobileCard={(row) => (
            <>
              <strong>{row.tradeName}</strong>
              <span>{row.email}</span>
              <AdminStatusBadge
                label={ADMIN_SELLER_STATUS_LABEL[row.status]}
                tone={sellerTone(row.status)}
              />
              <span>
                {formatCommission(row.commissionBps)} · {formatDate(row.createdAt)}
              </span>
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

      <AdminModal
        open={reasonAction?.type === "reject"}
        title={`Rejeitar ${reasonAction?.seller.tradeName ?? ""}`}
        onClose={() => setReasonAction(null)}
        actions={
          <>
            <button type="button" className={sharedStyles.btnGhost} onClick={() => setReasonAction(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className={sharedStyles.btnDanger}
              disabled={pendingActionId === reasonAction?.seller.id}
              onClick={() => void confirmReasonAction()}
            >
              Rejeitar
            </button>
          </>
        }
      >
        <label htmlFor="reject-reason">Motivo (opcional)</label>
        <textarea
          id="reject-reason"
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          rows={3}
          style={{ width: "100%" }}
        />
      </AdminModal>

      <AdminConfirmDialog
        open={reasonAction?.type === "suspend"}
        title={`Suspender ${reasonAction?.seller.tradeName ?? ""}`}
        description="A loja perde acesso ao painel e a novas vendas até ser reativada."
        confirmLabel="Suspender"
        busy={pendingActionId === reasonAction?.seller.id}
        onConfirm={() => void confirmReasonAction()}
        onClose={() => setReasonAction(null)}
      />
    </div>
  );
}
