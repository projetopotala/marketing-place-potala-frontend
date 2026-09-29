"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createAdminAdmin,
  listAdminAdmins,
  type AdminUser,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminDataTable, sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { AdminModal } from "@/components/admin/shared/AdminModal";
import { Field } from "@/components/admin/shared/AdminStatusBadge";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";

const PAGE_SIZE = 10;

const emptyForm = { name: "", email: "", password: "" };

/**
 * Real via GET/POST /admin/admins (identity-service, novo nesta sessão --
 * ver status-migracao-microservicos.md). Antes desta entrega não existia
 * NENHUM jeito de criar um admin além do seed direto no banco
 * (prisma/seed.ts, rodado uma vez no deploy, a partir de env vars) --
 * "cadastro de admin" era um item do backlog sem nenhuma tela nem mock
 * pra substituir, domínio novo de ponta a ponta.
 *
 * Escopo decidido explicitamente com o Arthur: só um admin já autenticado
 * consegue criar outro (POST /admin/admins nunca é @Public() no backend --
 * a classe inteira exige Role.ADMIN), e a tela é listar + criar, sem
 * editar/desativar/excluir (mesmo minimalismo já usado em
 * Categorias/Conteúdos na v1 de cada um).
 */
export function AdminsView() {
  const toast = useAdminToast();
  const [admins, setAdmins] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadPage = useCallback(async (cursor: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await listAdminAdmins({ limit: PAGE_SIZE, cursor });
      setAdmins(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      setAdmins(null);
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar os administradores.",
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
    if (!hasNextPage || !admins || admins.length === 0) return;
    const nextCursor = admins[admins.length - 1]?.id ?? null;
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

  function openCreate() {
    setForm(emptyForm);
    setFormError(null);
    setIsCreateOpen(true);
  }

  async function createAdmin() {
    const name = form.name.trim();
    const email = form.email.trim();
    const password = form.password;

    if (name.length < 2) {
      setFormError("Informe o nome completo.");
      return;
    }
    if (!email.includes("@")) {
      setFormError("Informe um e-mail válido.");
      return;
    }
    if (password.length < 8) {
      setFormError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const created = await createAdminAdmin({ name, email, password });
      toast.push(`${created.fullName ?? created.email} cadastrado como admin`);
      setIsCreateOpen(false);
      // Se estamos na primeira página, mostra o novo admin na hora; senão só
      // fecha o modal -- o novo registro aparece ao voltar pra página 1.
      if (pageIndex === 0) {
        void loadPage(null);
      }
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Não foi possível cadastrar o administrador.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function formatDate(value: string): string {
    return new Date(value).toLocaleDateString("pt-BR");
  }

  return (
    <div className={sharedStyles.stack}>
      <AdminPageHeader
        title="Administradores"
        description="Contas com acesso total ao painel admin. Só um admin já logado consegue cadastrar outro."
        actions={
          <button type="button" className={sharedStyles.btn} onClick={openCreate}>
            Novo administrador
          </button>
        }
      />

      {isLoading ? (
        <p role="status">Carregando administradores…</p>
      ) : error ? (
        <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
          {error}
        </p>
      ) : (
        <AdminDataTable
          caption="Lista de administradores"
          rows={admins ?? []}
          columns={[
            { key: "name", header: "Nome", render: (row) => row.fullName ?? "—" },
            { key: "email", header: "E-mail", render: (row) => row.email },
            {
              key: "createdAt",
              header: "Criado em",
              render: (row) => formatDate(row.createdAt),
            },
          ]}
          mobileCard={(row) => (
            <>
              <strong>{row.fullName ?? row.email}</strong>
              <span>{row.email}</span>
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

      <AdminModal
        open={isCreateOpen}
        title="Novo administrador"
        onClose={() => setIsCreateOpen(false)}
        actions={
          <>
            <button
              type="button"
              className={sharedStyles.btnGhost}
              onClick={() => setIsCreateOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={sharedStyles.btn}
              onClick={() => void createAdmin()}
              disabled={isSaving}
            >
              {isSaving ? "Cadastrando…" : "Cadastrar"}
            </button>
          </>
        }
      >
        <div className={sharedStyles.stack}>
          <Field label="Nome completo">
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </Field>
          <Field label="Senha (mínimo 8 caracteres)">
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
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
