"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";
import { ApiError } from "@/lib/api/client";
import {
  getMySellerSettings,
  updateMySellerSettings,
  type MySellerSettings,
} from "@/lib/api/sellers";
import { ADMIN_SELLER_STATUS_LABEL } from "@/lib/api/admin";
import styles from "@/components/seller/seller.module.css";

/**
 * Real via GET/PATCH /seller/settings (sellers-service, novo nesta
 * sessão — ver status-migracao-microservicos.md). Substitui o mock antigo
 * (`useAdminData`/`repo.updateSeller`, sem chamada de rede nenhuma, toast
 * "(demonstrativo)").
 *
 * Só tradeName/phone/description são editáveis aqui — mesma decisão do
 * backend (UpdateSellerSettingsDto): legalName, documento, email, status e
 * comissão são dados legais/administrativos, mostrados como leitura mas
 * fora de escopo pra edição pela própria loja nesta v1.
 */
export function SellerSettingsView() {
  const { push } = useAdminToast();

  const [settings, setSettings] = useState<MySellerSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [tradeName, setTradeName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await getMySellerSettings();
        if (cancelled) return;
        setSettings(result);
        setTradeName(result.tradeName);
        setPhone(result.phone);
        setDescription(result.description ?? "");
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError ? err.message : "Não foi possível carregar as configurações.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await updateMySellerSettings({
        tradeName: tradeName.trim(),
        phone: phone.trim(),
        description: description.trim(),
      });
      setSettings(updated);
      setTradeName(updated.tradeName);
      setPhone(updated.phone);
      setDescription(updated.description ?? "");
      push("Configurações da loja salvas.");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Não foi possível salvar as configurações.";
      setSaveError(message);
      push(message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p role="status">Carregando configurações…</p>;
  }

  if (loadError || !settings) {
    return (
      <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
        {loadError ?? "Não foi possível carregar as configurações."}
      </p>
    );
  }

  return (
    <>
      <header>
        <h1 className={styles.pageTitle}>Configurações</h1>
        <p className={styles.pageLead}>
          Identidade pública da loja. Slug: {settings.slug}
        </p>
      </header>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Dados da loja (somente leitura)</h2>
        <dl className={styles.formGrid}>
          <div className={styles.field}>
            <label>Razão social</label>
            <p>{settings.legalName}</p>
          </div>
          <div className={styles.field}>
            <label>Documento</label>
            <p>
              {settings.documentType === "CNPJ" ? "CNPJ" : "CPF"}: {settings.documentNumber}
            </p>
          </div>
          <div className={styles.field}>
            <label>E-mail</label>
            <p>{settings.email}</p>
          </div>
          <div className={styles.field}>
            <label>Status</label>
            <p>{ADMIN_SELLER_STATUS_LABEL[settings.status]}</p>
          </div>
        </dl>
      </section>

      <form className={`${styles.panel} ${styles.formGrid}`} onSubmit={save}>
        <h2 className={styles.panelTitle}>Editar</h2>
        <div className={styles.field}>
          <label htmlFor="shop-name">Nome da loja</label>
          <input
            id="shop-name"
            value={tradeName}
            onChange={(event) => setTradeName(event.target.value)}
            minLength={1}
            maxLength={200}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="shop-phone">Telefone</label>
          <input
            id="shop-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            minLength={1}
            maxLength={30}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="shop-description">Descrição</label>
          <textarea
            id="shop-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
          />
        </div>

        {saveError && (
          <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
            {saveError}
          </p>
        )}

        <button type="submit" className={styles.primaryBtn} disabled={isSaving}>
          {isSaving ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </>
  );
}
