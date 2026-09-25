"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_CUSTOMER_STATUS_LABEL,
  blockCustomer,
  listAdminCustomers,
  unblockCustomer,
  type AdminCustomer,
  type AdminCustomerStatus,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminDataTable, sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminStatusBadge } from "@/components/admin/shared/AdminStatusBadge";
import { AdminConfirmDialog } from "@/components/admin/shared/AdminModal";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";

const PAGE_SIZE = 10;

/**
 * Real via GET/PATCH /admin/customers (identity-service, novo nesta
 * sessão — ver status-migracao-microservicos.md). Substitui o mock antigo
 * (`useAdminData`, `db.customers`, com busca, filtro por status,
 * exportação CSV, tags/notas/produtos preferidos/cidade e link pra tela de
 * detalhe — nada disso tem contrapartida real).
 *
 * Removido de propósito, mesmo raciocínio já usado em SellersView.tsx:
 * - Sem busca nem filtro por status: backend só pagina por cursor.
 * - Sem exportar CSV: só exportaria a página atual, não todos os clientes.
 * - Sem tags/notas/produtos preferidos/cidade: não existem no backend —
 *   eram 100% inventados no mock.
 * - Sem link pra tela de detalhe: não existe GET /admin/customers/:id.
 *
 * Bloquear/desbloquear não fica registrado em nenhum lugar (identity-service
 * não tem model de AuditLog, diferente de sellers-service/catalog-service)
 * — só o status muda, sem histórico de quem fez o quê.
 */
function customerTone(status: AdminCustomerStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "BLOCKED") return "danger" as const;
  return "warning" as const;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

export function CustomersView() {
  const toast = useAdminToast();
  const [customers, setCustomers] = useState<AdminCustomer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminCustomer | null>(null);

  const loadPage = useCallback(async (cursor: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await listAdminCustomers({ limit: PAGE_SIZE, cursor });
      setCustomers(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setCustomers(null);
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar os clientes.",
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
    if (!hasNextPage || !customers || customers.length === 0) return;
    const nextCursor = customers[customers.length - 1]?.id ?? null;
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

  function applyResult(id: string, status: AdminCustomerStatus) {
    setCustomers((current) =>
      current ? current.map((c) => (c.id === id ? { ...c, status } : c)) : current,
    );
  }

  async function confirmStatusChange() {
    if (!statusTarget) return;
    setPendingActionId(statusTarget.id);
    try {
      const result =
        statusTarget.status === "BLOCKED"
          ? await unblockCustomer(statusTarget.id)
          : await blockCustomer(statusTarget.id);
      applyResult(statusTarget.id, result.status);
      toast.push(
        result.status === "BLOCKED" ? "Cliente bloqueado" : "Cliente desbloqueado",
      );
      setStatusTarget(null);
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
        title="Clientes"
        description="Bloqueie ou desbloqueie contas, direto do identity-service."
      />

      {isLoading ? (
        <p role="status">Carregando clientes…</p>
      ) : error ? (
        <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
          {error}
        </p>
      ) : (
        <AdminDataTable
          caption="Lista de clientes"
          rows={customers ?? []}
          columns={[
            {
              key: "name",
              header: "Cliente",
              render: (row) => row.fullName ?? "—",
            },
            { key: "email", header: "E-mail", render: (row) => row.email },
            {
              key: "phone",
              header: "Telefone",
              render: (row) => row.phone ?? "—",
            },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <AdminStatusBadge
                  label={ADMIN_CUSTOMER_STATUS_LABEL[row.status]}
                  tone={customerTone(row.status)}
                />
              ),
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
                <button
                  type="button"
                  className={sharedStyles.linkBtn}
                  disabled={pendingActionId === row.id}
                  onClick={() => setStatusTarget(row)}
                >
                  {row.status === "BLOCKED" ? "Desbloquear" : "Bloquear"}
                </button>
              ),
            },
          ]}
          mobileCard={(row) => (
            <>
              <strong>{row.fullName ?? row.email}</strong>
              <span>{row.email}</span>
              <AdminStatusBadge
                label={ADMIN_CUSTOMER_STATUS_LABEL[row.status]}
                tone={customerTone(row.status)}
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
        open={Boolean(statusTarget)}
        title={statusTarget?.status === "BLOCKED" ? "Desbloquear cliente" : "Bloquear cliente"}
        description={`Confirma alterar o status de ${statusTarget?.fullName ?? statusTarget?.email ?? ""}?`}
        confirmLabel="Confirmar"
        busy={pendingActionId === statusTarget?.id}
        onConfirm={() => void confirmStatusChange()}
        onClose={() => setStatusTarget(null)}
      />
    </div>
  );
}
