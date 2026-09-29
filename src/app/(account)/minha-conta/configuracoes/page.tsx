"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AccountChrome } from "@/components/account/AccountChrome";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/client";
import {
  getMyCustomerProfile,
  updateMyProfile,
} from "@/lib/api/customers";

/**
 * Real via PATCH /customers/me (identity-service, novo nesta sessão) --
 * substitui o mock antigo ("Preferências salvas apenas nesta sessão de
 * UI"). Só nome exibido/telefone são editáveis: e-mail continua
 * `readOnly` de propósito, não existe endpoint de troca de e-mail nesta
 * v1 (confirmado em customers.controller.ts -- só PATCH em fullName/
 * phone).
 */
export default function AccountSettingsPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyCustomerProfile().then((profile) => {
      if (cancelled) return;
      setFullName(profile?.fullName ?? user?.name ?? "");
      setPhone(profile?.phone ?? "");
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setStatus(null);
    try {
      await updateMyProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
      });
      setStatus("Preferências salvas.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar suas preferências.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AccountChrome
      title="Configurações"
      lead="Nome exibido e telefone de contato."
      breadcrumbCurrent="Configurações"
    >
      {isLoading ? (
        <p role="status">Carregando…</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
          <div>
            <label htmlFor="cfg-email">E-mail</label>
            <input
              id="cfg-email"
              value={user?.email ?? ""}
              readOnly
              style={{ width: "100%", minHeight: 44 }}
            />
          </div>
          <div>
            <label htmlFor="cfg-name">Nome exibido</label>
            <input
              id="cfg-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              style={{ width: "100%", minHeight: 44 }}
            />
          </div>
          <div>
            <label htmlFor="cfg-phone">Telefone</label>
            <input
              id="cfg-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              style={{ width: "100%", minHeight: 44 }}
            />
          </div>
          <button type="submit" disabled={isSaving} style={{ minHeight: 44 }}>
            {isSaving ? "Salvando…" : "Salvar preferências"}
          </button>
          {error ? (
            <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
              {error}
            </p>
          ) : null}
          {status ? (
            <p role="status" aria-live="polite">
              {status}
            </p>
          ) : null}
        </form>
      )}
    </AccountChrome>
  );
}
