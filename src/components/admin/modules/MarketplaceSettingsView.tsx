"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  getAdminSettings,
  MAX_ANNOUNCEMENT_TEXT_LENGTH,
  MAX_SUPPORT_EMAIL_LENGTH,
  SUPPORT_WHATSAPP_PATTERN,
  updateAdminSettings,
  type AdminMarketplaceSettings,
  type MarketplaceSettingsInput,
} from "@/lib/api/settings";
import { ANNOUNCEMENT_TEXT, CONTACT_INFO } from "@/data/marketplace";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { sharedStyles } from "@/components/admin/shared/AdminDataTable";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";

interface FormState {
  announcementEnabled: boolean;
  announcementText: string;
  supportEmail: string;
  supportWhatsapp: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Só variáveis já existentes do tema admin (areia/dourado). */
const CHECKBOX_LABEL_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  color: "var(--admin-text)",
  fontSize: "0.9rem",
  margin: "4px 0 12px",
  cursor: "pointer",
};
const HINT_STYLE: React.CSSProperties = { color: "var(--admin-muted)", fontSize: "0.75rem" };
const ERROR_STYLE: React.CSSProperties = {
  color: "var(--admin-danger)",
  fontSize: "0.75rem",
  fontWeight: 600,
};

function toForm(settings: AdminMarketplaceSettings): FormState {
  return {
    announcementEnabled: settings.announcementEnabled,
    announcementText: settings.announcementText ?? "",
    supportEmail: settings.supportEmail ?? "",
    supportWhatsapp: settings.supportWhatsapp ?? "",
  };
}

function toInput(form: FormState): MarketplaceSettingsInput {
  const text = form.announcementText.trim();
  const email = form.supportEmail.trim();
  const whatsapp = form.supportWhatsapp.replace(/\D/g, "");
  return {
    announcementEnabled: form.announcementEnabled,
    announcementText: text || null,
    supportEmail: email || null,
    supportWhatsapp: whatsapp || null,
  };
}

/** Espelha o UpdateSettingsDto do catalog-service (o backend valida de novo). */
function validate(form: FormState): FormErrors {
  const input = toInput(form);
  const errors: FormErrors = {};
  if (input.announcementText && input.announcementText.length > MAX_ANNOUNCEMENT_TEXT_LENGTH) {
    errors.announcementText = `Use no máximo ${MAX_ANNOUNCEMENT_TEXT_LENGTH} caracteres.`;
  }
  if (
    input.supportEmail &&
    (input.supportEmail.length > MAX_SUPPORT_EMAIL_LENGTH || !EMAIL_PATTERN.test(input.supportEmail))
  ) {
    errors.supportEmail = "Informe um e-mail válido.";
  }
  if (input.supportWhatsapp && !SUPPORT_WHATSAPP_PATTERN.test(input.supportWhatsapp)) {
    errors.supportWhatsapp = "Use DDI 55 + DDD + número, ex.: 55 11 99999-0000.";
  }
  return errors;
}

function sameForm(a: FormState, b: FormState): boolean {
  return JSON.stringify(toInput(a)) === JSON.stringify(toInput(b));
}

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 401 || cause.status === 403) {
      return "Sua sessão não tem permissão de administrador para esta ação.";
    }
    return cause.message;
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

export function MarketplaceSettingsView() {
  const toast = useAdminToast();
  const ids = useId();
  const [saved, setSaved] = useState<AdminMarketplaceSettings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    getAdminSettings()
      .then((settings) => {
        if (!active) return;
        setSaved(settings);
        setForm(toForm(settings));
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const load = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    setReloadKey((key) => key + 1);
  }, []);

  const errors = useMemo(() => (form ? validate(form) : {}), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const isDirty = Boolean(form && saved && !sameForm(form, toForm(saved)));

  function patch(next: Partial<FormState>) {
    setForm((current) => (current ? { ...current, ...next } : current));
    setSaveError(null);
  }

  function discard() {
    if (!saved) return;
    setForm(toForm(saved));
    setSubmitted(false);
    setSaveError(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSubmitted(true);
    if (hasErrors) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await updateAdminSettings(toInput(form));
      setSaved(updated);
      setForm(toForm(updated));
      setSubmitted(false);
      toast.push("Configurações salvas");
    } catch (cause) {
      const message = errorMessage(cause);
      setSaveError(message);
      toast.push(message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  const showError = (field: keyof FormState) =>
    submitted || (form && saved && form[field] !== toForm(saved)[field]) ? errors[field] : undefined;

  const header = (
    <AdminPageHeader
      title="Configurações"
      description="Parâmetros globais do marketplace exibidos na vitrine. Comissões, frete e pagamentos não são editados aqui."
    />
  );

  if (isLoading && !form) {
    return (
      <div className={sharedStyles.stack}>
        {header}
        <div className={sharedStyles.skeleton} aria-busy="true" aria-label="Carregando configurações" />
      </div>
    );
  }

  if (!form || !saved) {
    return (
      <div className={sharedStyles.stack}>
        {header}
        <div className={sharedStyles.panel} role="alert">
          <h2 className={sharedStyles.panelTitle}>Não foi possível carregar as configurações</h2>
          <p>{loadError ?? "Resposta inesperada do servidor."}</p>
          <p>Nenhum valor local ou demonstrativo é exibido no lugar das configurações reais.</p>
          <div className={sharedStyles.actions}>
            <button type="button" className={sharedStyles.btn} onClick={() => void load()}>
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  const textId = `${ids}-announcement-text`;
  const emailId = `${ids}-support-email`;
  const whatsappId = `${ids}-support-whatsapp`;
  const textLength = form.announcementText.trim().length;

  return (
    <form className={sharedStyles.stack} onSubmit={(event) => void save(event)} noValidate>
      {header}

      <section className={sharedStyles.panel} aria-labelledby={`${ids}-announcement`}>
        <h2 id={`${ids}-announcement`} className={sharedStyles.panelTitle}>Aviso da vitrine</h2>
        <label style={CHECKBOX_LABEL_STYLE}>
          <input
            type="checkbox"
            checked={form.announcementEnabled}
            onChange={(event) => patch({ announcementEnabled: event.target.checked })}
            style={{ accentColor: "var(--admin-gold)", width: 18, height: 18 }}
          />
          Exibir aviso no topo da vitrine
        </label>
        <div className={sharedStyles.field}>
          <label htmlFor={textId}>Texto do aviso</label>
          <input
            id={textId}
            value={form.announcementText}
            maxLength={MAX_ANNOUNCEMENT_TEXT_LENGTH + 20}
            placeholder={ANNOUNCEMENT_TEXT}
            disabled={!form.announcementEnabled}
            aria-invalid={Boolean(showError("announcementText"))}
            aria-describedby={`${textId}-hint${showError("announcementText") ? ` ${textId}-error` : ""}`}
            onChange={(event) => patch({ announcementText: event.target.value })}
          />
          <small id={`${textId}-hint`} style={HINT_STYLE}>
            {textLength}/{MAX_ANNOUNCEMENT_TEXT_LENGTH}. Em branco, a vitrine mantém o texto padrão.
          </small>
          {showError("announcementText") ? (
            <small id={`${textId}-error`} role="alert" style={ERROR_STYLE}>{errors.announcementText}</small>
          ) : null}
        </div>
      </section>

      <section className={sharedStyles.panel} aria-labelledby={`${ids}-contact`}>
        <h2 id={`${ids}-contact`} className={sharedStyles.panelTitle}>Contato de suporte</h2>
        <div className={sharedStyles.field}>
          <label htmlFor={emailId}>E-mail de suporte</label>
          <input
            id={emailId}
            type="email"
            autoComplete="off"
            value={form.supportEmail}
            placeholder={CONTACT_INFO.email}
            aria-invalid={Boolean(showError("supportEmail"))}
            aria-describedby={showError("supportEmail") ? `${emailId}-error` : undefined}
            onChange={(event) => patch({ supportEmail: event.target.value })}
          />
          {showError("supportEmail") ? (
            <small id={`${emailId}-error`} role="alert" style={ERROR_STYLE}>{errors.supportEmail}</small>
          ) : null}
        </div>
        <div className={sharedStyles.field}>
          <label htmlFor={whatsappId}>WhatsApp de suporte</label>
          <input
            id={whatsappId}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={form.supportWhatsapp}
            placeholder="55 11 99999-0000"
            aria-invalid={Boolean(showError("supportWhatsapp"))}
            aria-describedby={`${whatsappId}-hint${showError("supportWhatsapp") ? ` ${whatsappId}-error` : ""}`}
            onChange={(event) => patch({ supportWhatsapp: event.target.value })}
          />
          <small id={`${whatsappId}-hint`} style={HINT_STYLE}>
            Exibido no rodapé com link para o WhatsApp. Em branco, mantém o telefone padrão.
          </small>
          {showError("supportWhatsapp") ? (
            <small id={`${whatsappId}-error`} role="alert" style={ERROR_STYLE}>{errors.supportWhatsapp}</small>
          ) : null}
        </div>
      </section>

      {saveError ? (
        <div className={sharedStyles.panel} role="alert">
          <p>{saveError}</p>
        </div>
      ) : null}

      <div className={sharedStyles.actions}>
        <small style={HINT_STYLE}>
          {saved.updatedAt
            ? `Última alteração em ${new Date(saved.updatedAt).toLocaleString("pt-BR")}.`
            : "Ainda não salvo: a vitrine usa os textos padrão."}
        </small>
        <button
          type="button"
          className={sharedStyles.btnGhost}
          onClick={discard}
          disabled={!isDirty || isSaving}
        >
          Descartar alterações
        </button>
        <button
          type="submit"
          className={sharedStyles.btn}
          disabled={!isDirty || isSaving || (submitted && hasErrors)}
        >
          {isSaving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
