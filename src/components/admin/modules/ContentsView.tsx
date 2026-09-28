"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_CONTENT_FORMAT_LABEL,
  ADMIN_CONTENT_STATUS_LABEL,
  approveAdminContent,
  archiveAdminContent,
  createAdminContent,
  listAdminContents,
  rejectAdminContent,
  submitAdminContentForReview,
  updateAdminContent,
  type AdminContent,
  type AdminContentFormat,
  type AdminContentStatus,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminDataTable, sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminStatusBadge, AdminEmptyState, Field } from "@/components/admin/shared/AdminStatusBadge";
import { AdminModal } from "@/components/admin/shared/AdminModal";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";

/**
 * Real via GET/POST/PATCH /admin/contents (catalog-service, domínio novo) --
 * ver o comentário completo em lib/api/admin.ts sobre o escopo v1 (só
 * cadastro + moderação, decidido com o Arthur) e o que foi cortado do mock
 * antigo (busca, filtro por status, exportar CSV, "Alunos", módulos/aulas,
 * link pra tela de detalhe) e por quê.
 */

const PAGE_SIZE = 10;

function contentTone(status: AdminContentStatus) {
  if (status === "PUBLISHED") return "success" as const;
  if (status === "REVIEW") return "warning" as const;
  if (status === "REJECTED") return "danger" as const;
  return "muted" as const;
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

interface ContentFormState {
  title: string;
  instructor: string;
  category: string;
  format: AdminContentFormat;
  priceCents: number;
  description: string;
}

const EMPTY_FORM: ContentFormState = {
  title: "",
  instructor: "",
  category: "Cursos",
  format: "VIDEO",
  priceCents: 9900,
  description: "",
};

export function ContentsView() {
  const toast = useAdminToast();
  const [contents, setContents] = useState<AdminContent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const [modal, setModal] = useState<"create" | AdminContent | null>(null);
  const [form, setForm] = useState<ContentFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<AdminContent | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const loadPage = useCallback(async (cursor: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await listAdminContents({ limit: PAGE_SIZE, cursor });
      setContents(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setContents(null);
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar os conteúdos.",
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
    if (!hasNextPage || !contents || contents.length === 0) return;
    const nextCursor = contents[contents.length - 1]?.id ?? null;
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

  function applyResult(id: string, updated: AdminContent) {
    setContents((current) =>
      current ? current.map((c) => (c.id === id ? updated : c)) : current,
    );
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setModal("create");
  }

  function openEdit(content: AdminContent) {
    setForm({
      title: content.title,
      instructor: content.instructor,
      category: content.category,
      format: content.format,
      priceCents: content.priceCents,
      description: content.description,
    });
    setModal(content);
  }

  async function save() {
    if (!form.title.trim()) {
      toast.push("Informe o título", "error");
      return;
    }
    setIsSaving(true);
    try {
      if (modal === "create") {
        const created = await createAdminContent({
          title: form.title.trim(),
          instructor: form.instructor.trim() || "Instrutor",
          category: form.category.trim() || "Cursos",
          format: form.format,
          priceCents: form.priceCents,
          description: form.description.trim(),
        });
        setContents((current) => (current ? [created, ...current] : [created]));
        toast.push("Conteúdo criado");
      } else if (modal) {
        const updated = await updateAdminContent(modal.id, {
          title: form.title.trim(),
          instructor: form.instructor.trim(),
          category: form.category.trim(),
          format: form.format,
          priceCents: form.priceCents,
          description: form.description.trim(),
        });
        applyResult(modal.id, updated);
        toast.push("Conteúdo atualizado");
      }
      setModal(null);
    } catch (err) {
      toast.push(
        err instanceof ApiError ? err.message : "Não foi possível salvar o conteúdo.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function runTransition(
    content: AdminContent,
    action: (id: string) => Promise<AdminContent>,
    successMessage: string,
  ) {
    setPendingActionId(content.id);
    try {
      const updated = await action(content.id);
      applyResult(content.id, updated);
      toast.push(successMessage);
    } catch (err) {
      toast.push(
        err instanceof ApiError ? err.message : "Não foi possível concluir a ação.",
        "error",
      );
    } finally {
      setPendingActionId(null);
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setIsRejecting(true);
    try {
      const updated = await rejectAdminContent(rejectTarget.id, rejectNote.trim() || undefined);
      applyResult(rejectTarget.id, updated);
      toast.push("Conteúdo rejeitado");
      setRejectTarget(null);
    } catch (err) {
      toast.push(
        err instanceof ApiError ? err.message : "Não foi possível rejeitar o conteúdo.",
        "error",
      );
    } finally {
      setIsRejecting(false);
    }
  }

  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader
        title="Conteúdos / Cursos"
        description="Cadastre e modere conteúdos do marketplace (v1: sem módulos/aulas, sem matrícula de aluno)."
        actions={
          <button type="button" className={sharedStyles.btn} onClick={openCreate}>
            Novo conteúdo
          </button>
        }
      />

      {isLoading ? (
        <p role="status">Carregando conteúdos…</p>
      ) : error ? (
        <AdminEmptyState title="Não foi possível carregar os conteúdos" description={error} />
      ) : (
        <AdminDataTable
          caption="Lista de conteúdos"
          rows={contents ?? []}
          columns={[
            { key: "title", header: "Título", render: (row) => row.title },
            { key: "instructor", header: "Instrutor", render: (row) => row.instructor },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <AdminStatusBadge
                  label={ADMIN_CONTENT_STATUS_LABEL[row.status]}
                  tone={contentTone(row.status)}
                />
              ),
            },
            { key: "price", header: "Preço", render: (row) => formatMoney(row.priceCents) },
            {
              key: "actions",
              header: "Ações",
              render: (row) => (
                <div className={sharedStyles.rowActions}>
                  <button
                    type="button"
                    className={sharedStyles.linkBtn}
                    disabled={pendingActionId === row.id}
                    onClick={() => openEdit(row)}
                  >
                    Editar
                  </button>
                  {row.status === "DRAFT" ? (
                    <button
                      type="button"
                      className={sharedStyles.linkBtn}
                      disabled={pendingActionId === row.id}
                      onClick={() =>
                        void runTransition(row, submitAdminContentForReview, "Enviado para revisão")
                      }
                    >
                      Enviar p/ revisão
                    </button>
                  ) : null}
                  {row.status === "REVIEW" ? (
                    <>
                      <button
                        type="button"
                        className={sharedStyles.linkBtn}
                        disabled={pendingActionId === row.id}
                        onClick={() =>
                          void runTransition(row, approveAdminContent, "Aprovado e publicado")
                        }
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className={sharedStyles.linkBtn}
                        disabled={pendingActionId === row.id}
                        onClick={() => {
                          setRejectTarget(row);
                          setRejectNote("");
                        }}
                      >
                        Rejeitar
                      </button>
                    </>
                  ) : null}
                  {row.status === "PUBLISHED" ? (
                    <button
                      type="button"
                      className={sharedStyles.linkBtn}
                      disabled={pendingActionId === row.id}
                      onClick={() => void runTransition(row, archiveAdminContent, "Arquivado")}
                    >
                      Arquivar
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
          mobileCard={(row) => (
            <>
              <span>{row.title}</span>
              <span>{row.instructor}</span>
              <AdminStatusBadge
                label={ADMIN_CONTENT_STATUS_LABEL[row.status]}
                tone={contentTone(row.status)}
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
        title={modal === "create" ? "Novo conteúdo" : "Editar conteúdo"}
        onClose={() => setModal(null)}
        actions={
          <>
            <button type="button" className={sharedStyles.btnGhost} onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button type="button" className={sharedStyles.btn} disabled={isSaving} onClick={() => void save()}>
              Salvar
            </button>
          </>
        }
      >
        <div className={sharedStyles.stack}>
          <Field label="Título">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Instrutor">
            <input
              value={form.instructor}
              onChange={(e) => setForm({ ...form, instructor: e.target.value })}
            />
          </Field>
          <Field label="Categoria">
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Field>
          <Field label="Formato">
            <select
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value as AdminContentFormat })}
            >
              {(Object.keys(ADMIN_CONTENT_FORMAT_LABEL) as AdminContentFormat[]).map((key) => (
                <option key={key} value={key}>
                  {ADMIN_CONTENT_FORMAT_LABEL[key]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Preço (centavos)">
            <input
              type="number"
              value={form.priceCents}
              onChange={(e) => setForm({ ...form, priceCents: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Descrição">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
        </div>
      </AdminModal>

      <AdminModal
        open={Boolean(rejectTarget)}
        title="Rejeitar conteúdo"
        onClose={() => setRejectTarget(null)}
        actions={
          <>
            <button type="button" className={sharedStyles.btnGhost} onClick={() => setRejectTarget(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className={sharedStyles.btnDanger}
              disabled={isRejecting}
              onClick={() => void confirmReject()}
            >
              Rejeitar
            </button>
          </>
        }
      >
        <Field label="Motivo (opcional)">
          <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
        </Field>
      </AdminModal>
    </div>
  );
}
