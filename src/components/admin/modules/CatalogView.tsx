"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_CATEGORY_STATUS_LABEL,
  createAdminCategory,
  listAdminCategories,
  updateAdminCategory,
  type AdminCategory,
  type AdminCategoryStatus,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import {
  AdminMetricCard,
  AdminMetricsRow,
} from "@/components/admin/shared/AdminMetricCard";
import { AdminDataTable, sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminStatusBadge, Field } from "@/components/admin/shared/AdminStatusBadge";
import { AdminModal } from "@/components/admin/shared/AdminModal";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";

function categoryTone(status: AdminCategoryStatus) {
  return status === "ACTIVE" ? ("success" as const) : ("muted" as const);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

/**
 * Real via GET/POST/PATCH /admin/categories (catalog-service, através do
 * gateway) — antes desta sessão essa tela era 100% dado demo
 * (AdminDataContext) e não existia NENHUM jeito de cadastrar uma categoria
 * a não ser SQL direto no Supabase (foi exatamente o que travou o teste da
 * tela "novo produto" do vendedor).
 *
 * Escopo decidido explicitamente com o Arthur: lista simples (nome, slug
 * gerado automaticamente, ativar/desativar) — SEM hierarquia de categoria
 * pai/filha, mesmo o schema já suportando isso (Category.parentId). Também
 * SEM os "atributos" que a versão demo desta tela tinha: catalog-service não
 * tem (e nunca teve) nenhum model de atributo — era 100% dado fake, sem
 * contrapartida real no backend, então foi removido daqui em vez de deixado
 * fingindo funcionar. Sem exclusão: uma categoria é desativada
 * (status: INACTIVE), nunca apagada — Product.categoryId é ON DELETE
 * RESTRICT no schema, então um DELETE de verdade falharia assim que
 * qualquer produto referenciasse a categoria mesmo.
 */
export function CatalogView() {
  const toast = useAdminToast();
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [editing, setEditing] = useState<"create" | AdminCategory | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setCategories(await listAdminCategories());
    } catch (err) {
      setCategories(null);
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar as categorias.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = {
    total: categories?.length ?? 0,
    active: categories?.filter((c) => c.status === "ACTIVE").length ?? 0,
    inactive: categories?.filter((c) => c.status === "INACTIVE").length ?? 0,
  };

  function openCreate() {
    setNameInput("");
    setFormError(null);
    setEditing("create");
  }

  function openEdit(category: AdminCategory) {
    setNameInput(category.name);
    setFormError(null);
    setEditing(category);
  }

  async function saveCategory() {
    const name = nameInput.trim();
    if (!name) {
      setFormError("Informe o nome.");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      if (editing === "create") {
        const created = await createAdminCategory(name);
        setCategories((current) => (current ? [...current, created] : [created]));
        toast.push(`${created.name} criada`);
      } else if (editing) {
        const updated = await updateAdminCategory(editing.id, { name });
        setCategories((current) =>
          current ? current.map((c) => (c.id === updated.id ? updated : c)) : current,
        );
        toast.push(`${updated.name} atualizada`);
      }
      setEditing(null);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Não foi possível salvar a categoria.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleStatus(category: AdminCategory) {
    const nextStatus: AdminCategoryStatus =
      category.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setPendingId(category.id);
    try {
      const updated = await updateAdminCategory(category.id, { status: nextStatus });
      setCategories((current) =>
        current ? current.map((c) => (c.id === updated.id ? updated : c)) : current,
      );
      toast.push(
        nextStatus === "ACTIVE" ? `${updated.name} ativada` : `${updated.name} desativada`,
      );
    } catch (err) {
      toast.push(
        err instanceof ApiError ? err.message : "Não foi possível alterar o status.",
        "error",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader
        title="Categorias"
        description="Categorias do catálogo — lista simples, sem hierarquia (produtos referenciam diretamente)."
        actions={
          <button type="button" className={sharedStyles.btn} onClick={openCreate}>
            Nova categoria
          </button>
        }
      />

      <AdminMetricsRow>
        <AdminMetricCard label="Total" value={String(metrics.total)} />
        <AdminMetricCard label="Ativas" value={String(metrics.active)} />
        <AdminMetricCard label="Inativas" value={String(metrics.inactive)} />
      </AdminMetricsRow>

      {isLoading ? (
        <p role="status">Carregando categorias…</p>
      ) : error ? (
        <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
          {error}
        </p>
      ) : (
        <AdminDataTable
          caption="Lista de categorias"
          rows={categories ?? []}
          columns={[
            { key: "name", header: "Nome", render: (row) => row.name },
            { key: "slug", header: "Slug", render: (row) => row.slug },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <AdminStatusBadge
                  label={ADMIN_CATEGORY_STATUS_LABEL[row.status]}
                  tone={categoryTone(row.status)}
                />
              ),
            },
            {
              key: "createdAt",
              header: "Criada em",
              render: (row) => formatDate(row.createdAt),
            },
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
                    disabled={pendingId === row.id}
                    onClick={() => void toggleStatus(row)}
                  >
                    {row.status === "ACTIVE" ? "Desativar" : "Ativar"}
                  </button>
                </div>
              ),
            },
          ]}
          mobileCard={(row) => (
            <>
              <strong>{row.name}</strong>
              <span>{row.slug}</span>
              <AdminStatusBadge
                label={ADMIN_CATEGORY_STATUS_LABEL[row.status]}
                tone={categoryTone(row.status)}
              />
            </>
          )}
        />
      )}

      <AdminModal
        open={Boolean(editing)}
        title={editing === "create" ? "Nova categoria" : "Editar categoria"}
        onClose={() => setEditing(null)}
        actions={
          <>
            <button
              type="button"
              className={sharedStyles.btnGhost}
              onClick={() => setEditing(null)}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={sharedStyles.btn}
              onClick={() => void saveCategory()}
              disabled={isSaving}
            >
              {isSaving ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        <div className={sharedStyles.stack}>
          <Field label="Nome">
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
          </Field>
          {formError ? (
            <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
              {formError}
            </p>
          ) : null}
        </div>
      </AdminModal>
    </div>
  );
}
