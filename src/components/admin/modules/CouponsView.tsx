"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COUPON_STATUS_LABEL,
  activateCoupon,
  createCoupon,
  deactivateCoupon,
  deleteCoupon,
  listAdminCoupons,
  updateCoupon,
  type Coupon,
  type CouponDiscountType,
  type CouponStatus,
} from "@/lib/api/coupons";
import { ApiError } from "@/lib/api/client";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminDataTable, sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminStatusBadge } from "@/components/admin/shared/AdminStatusBadge";
import { AdminModal, AdminConfirmDialog } from "@/components/admin/shared/AdminModal";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";

const PAGE_SIZE = 10;

/**
 * Real via GET/POST/PATCH/DELETE /admin/coupons (orders-service, novo
 * nesta sessão -- pedido de Arthur, urgente, ver
 * status-migracao-microservicos.md). Substitui o mock antigo
 * (`useAdminData`, `db.coupons`, tudo em memória no navegador).
 *
 * Removido de propósito, mesmo raciocínio já usado em CustomersView.tsx:
 * - Sem busca nem filtro por status: backend só pagina por cursor, não
 *   tem busca por texto nem filtro por status server-side.
 * - Sem exportar CSV: só exportaria a página atual, não todos os cupons.
 * - Sem cartões de métrica (total/ativos/usos/receita): exigiriam somar
 *   TODOS os cupons, não só a página carregada -- não existe endpoint de
 *   agregado, e mostrar um total calculado só da página atual seria
 *   enganoso.
 * - Sem "canal" (site/app/todos): não existe app do marketplace, só o
 *   storefront web -- campo removido do backend (ver comentário no model
 *   Coupon, schema.prisma), removido daqui também.
 * - Status no formulário virou um checkbox "Habilitado", não mais um
 *   select de 4 opções: "agendado"/"expirado" são derivados de
 *   comeca_em/termina_em no backend, nunca algo que o admin define
 *   diretamente.
 *
 * "Duplicar" continua 100% client-side (só pré-preenche o modal de
 * criação) -- no mock já era assim, nunca chamava o backend.
 */
function couponTone(status: CouponStatus) {
  if (status === "active") return "success" as const;
  if (status === "scheduled") return "info" as const;
  if (status === "expired") return "muted" as const;
  return "danger" as const;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatDiscount(coupon: Pick<Coupon, "discountType" | "discountValue">): string {
  return coupon.discountType === "PERCENT"
    ? `${coupon.discountValue}%`
    : (coupon.discountValue / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
}

/** <input type="datetime-local"> works in the browser's local time and has no seconds/timezone -- this pair converts to/from ISO 8601 (what the backend stores and returns). */
function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(local: string): string {
  return new Date(local).toISOString();
}

function defaultStartsAt(): string {
  return toDatetimeLocalValue(new Date().toISOString());
}

function defaultEndsAt(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return toDatetimeLocalValue(date.toISOString());
}

type FormState = {
  code: string;
  name: string;
  discountType: CouponDiscountType;
  discountValue: number;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
};

function emptyForm(): FormState {
  return {
    code: "",
    name: "",
    discountType: "PERCENT",
    discountValue: 10,
    startsAt: defaultStartsAt(),
    endsAt: defaultEndsAt(),
    enabled: true,
  };
}

export function CouponsView() {
  const toast = useAdminToast();
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [modal, setModal] = useState<"create" | Coupon | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const loadPage = useCallback(async (cursor: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await listAdminCoupons({ limit: PAGE_SIZE, cursor });
      setCoupons(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setCoupons(null);
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os cupons.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(cursorStack[pageIndex] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, loadPage]);

  function goNext() {
    if (!hasNextPage || !coupons || coupons.length === 0) return;
    const nextCursor = coupons[coupons.length - 1]?.id ?? null;
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

  function reloadCurrentPage() {
    void loadPage(cursorStack[pageIndex] ?? null);
  }

  function openCreate() {
    setForm(emptyForm());
    setFormError(null);
    setModal("create");
  }

  function openEdit(coupon: Coupon) {
    setForm({
      code: coupon.code,
      name: coupon.name,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      startsAt: toDatetimeLocalValue(coupon.startsAt),
      endsAt: toDatetimeLocalValue(coupon.endsAt),
      enabled: coupon.enabled,
    });
    setFormError(null);
    setModal(coupon);
  }

  function duplicate(coupon: Coupon) {
    setForm({
      code: `${coupon.code}-COPY`,
      name: `${coupon.name} (cópia)`,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      startsAt: defaultStartsAt(),
      endsAt: defaultEndsAt(),
      enabled: false,
    });
    setFormError(null);
    setModal("create");
  }

  async function save() {
    if (!form.code.trim() || !form.name.trim()) {
      setFormError("Informe código e nome.");
      return;
    }
    setIsSaving(true);
    setFormError(null);
    const input = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      discountType: form.discountType,
      discountValue: form.discountValue,
      startsAt: fromDatetimeLocalValue(form.startsAt),
      endsAt: fromDatetimeLocalValue(form.endsAt),
      enabled: form.enabled,
    };
    try {
      if (modal === "create") {
        await createCoupon(input);
        toast.push("Cupom criado");
      } else if (modal) {
        await updateCoupon(modal.id, input);
        toast.push("Cupom atualizado");
      }
      setModal(null);
      reloadCurrentPage();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível salvar o cupom.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleEnabled(coupon: Coupon) {
    setPendingActionId(coupon.id);
    try {
      if (coupon.enabled) {
        await deactivateCoupon(coupon.id);
        toast.push("Cupom desativado");
      } else {
        await activateCoupon(coupon.id);
        toast.push("Cupom ativado");
      }
      reloadCurrentPage();
    } catch (err) {
      toast.push(
        err instanceof ApiError ? err.message : "Não foi possível concluir a ação.",
        "error",
      );
    } finally {
      setPendingActionId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setPendingActionId(deleteTarget.id);
    try {
      await deleteCoupon(deleteTarget.id);
      toast.push("Cupom excluído");
      setDeleteTarget(null);
      reloadCurrentPage();
    } catch (err) {
      toast.push(
        err instanceof ApiError ? err.message : "Não foi possível excluir o cupom.",
        "error",
      );
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader
        title="Cupons"
        description="Crie, duplique e controle cupons promocionais do marketplace."
        actions={
          <button type="button" className={sharedStyles.btn} onClick={openCreate}>
            Novo cupom
          </button>
        }
      />

      {isLoading ? (
        <p role="status">Carregando cupons…</p>
      ) : error ? (
        <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
          {error}
        </p>
      ) : (
        <AdminDataTable
          caption="Cupons"
          rows={coupons ?? []}
          columns={[
            { key: "code", header: "Código", render: (row) => row.code },
            { key: "name", header: "Nome", render: (row) => row.name },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <AdminStatusBadge
                  label={COUPON_STATUS_LABEL[row.status]}
                  tone={couponTone(row.status)}
                />
              ),
            },
            { key: "discount", header: "Desconto", render: (row) => formatDiscount(row) },
            {
              key: "period",
              header: "Vigência",
              render: (row) => `${formatDate(row.startsAt)} – ${formatDate(row.endsAt)}`,
            },
            { key: "usage", header: "Usos", render: (row) => String(row.usageCount) },
            {
              key: "actions",
              header: "Ações",
              render: (row) => (
                <div className={sharedStyles.rowActions}>
                  <button
                    type="button"
                    className={sharedStyles.linkBtn}
                    onClick={() => openEdit(row)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className={sharedStyles.linkBtn}
                    disabled={pendingActionId === row.id}
                    onClick={() => void toggleEnabled(row)}
                  >
                    {row.enabled ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    className={sharedStyles.linkBtn}
                    onClick={() => duplicate(row)}
                  >
                    Duplicar
                  </button>
                  <button
                    type="button"
                    className={sharedStyles.linkBtn}
                    onClick={() => setDeleteTarget(row)}
                  >
                    Excluir
                  </button>
                </div>
              ),
            },
          ]}
          mobileCard={(row) => (
            <>
              <strong>{row.code}</strong>
              <span>{row.name}</span>
              <AdminStatusBadge
                label={COUPON_STATUS_LABEL[row.status]}
                tone={couponTone(row.status)}
              />
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
        open={Boolean(modal)}
        title={modal === "create" ? "Novo cupom" : "Editar cupom"}
        onClose={() => setModal(null)}
        actions={
          <>
            <button type="button" className={sharedStyles.btnGhost} onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className={sharedStyles.btn}
              disabled={isSaving}
              onClick={() => void save()}
            >
              {isSaving ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        <form
          className={sharedStyles.stack}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className={sharedStyles.field}>
            <label htmlFor="coupon-code">Código</label>
            <input
              id="coupon-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              maxLength={30}
              required
            />
          </div>
          <div className={sharedStyles.field}>
            <label htmlFor="coupon-name">Nome</label>
            <input
              id="coupon-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={200}
              required
            />
          </div>
          <div className={sharedStyles.grid2}>
            <div className={sharedStyles.field}>
              <label htmlFor="coupon-discount-type">Tipo</label>
              <select
                id="coupon-discount-type"
                value={form.discountType}
                onChange={(e) =>
                  setForm({ ...form, discountType: e.target.value as CouponDiscountType })
                }
              >
                <option value="PERCENT">Percentual</option>
                <option value="FIXED">Valor fixo (centavos)</option>
              </select>
            </div>
            <div className={sharedStyles.field}>
              <label htmlFor="coupon-discount-value">Valor</label>
              <input
                id="coupon-discount-value"
                type="number"
                min={1}
                max={form.discountType === "PERCENT" ? 100 : 1_000_000}
                value={form.discountValue}
                onChange={(e) =>
                  setForm({ ...form, discountValue: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <div className={sharedStyles.grid2}>
            <div className={sharedStyles.field}>
              <label htmlFor="coupon-starts-at">Início da vigência</label>
              <input
                id="coupon-starts-at"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                required
              />
            </div>
            <div className={sharedStyles.field}>
              <label htmlFor="coupon-ends-at">Fim da vigência</label>
              <input
                id="coupon-ends-at"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                required
              />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            Habilitado
          </label>

          {formError && (
            <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
              {formError}
            </p>
          )}
        </form>
      </AdminModal>

      <AdminConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir cupom"
        description={`Confirma excluir o cupom ${deleteTarget?.code ?? ""}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        busy={pendingActionId === deleteTarget?.id}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
