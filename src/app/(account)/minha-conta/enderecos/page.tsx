"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AccountChrome } from "@/components/account/AccountChrome";
import { ApiError } from "@/lib/api/client";
import {
  createMyAddress,
  deleteMyAddress,
  getMyCustomerProfile,
  setMyDefaultAddress,
  updateMyAddress,
  type AddressInput,
  type CustomerAddressResponse,
} from "@/lib/api/customers";

const emptyForm: AddressInput = {
  label: "",
  recipient: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  postalCode: "",
  isDefault: false,
};

/**
 * Real via /customers/me/addresses (identity-service, CRUD novo nesta
 * sessão -- ver status-migracao-microservicos.md) -- substitui o CRUD
 * 100% local que existia aqui (AccountDataContext/localStorage). O model
 * `Address` já existia no backend desde o início (só faltavam os
 * endpoints de escrita -- GET /customers/me já lia isso, ver
 * `/minha-conta`), então os endereços aqui e no dashboard agora vêm
 * sempre da mesma fonte, sem divergência possível (gap conhecido, já
 * registrado no status doc, que esta entrega fecha).
 *
 * `state` (UF) sempre 2 letras -- mesma validação já usada no formulário
 * de checkout. O backend recusa remover o endereço padrão com um 400 cuja
 * mensagem já vem pronta pra exibir (duas variações, ver
 * CustomersService.deleteAddress).
 */
export default function AccountAddressesPage() {
  const [addresses, setAddresses] = useState<CustomerAddressResponse[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<AddressInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const profile = await getMyCustomerProfile();
      setAddresses(profile?.addresses ?? []);
    } catch (err) {
      setAddresses(null);
      setLoadError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar seus endereços.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function startEdit(address: CustomerAddressResponse) {
    setEditingId(address.id);
    setForm({
      label: address.label ?? "",
      recipient: address.recipient,
      street: address.street,
      number: address.number,
      complement: address.complement ?? "",
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      isDefault: address.isDefault,
    });
    setFormError(null);
    setStatus(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (
      !form.recipient.trim() ||
      !form.street.trim() ||
      !form.number.trim() ||
      !form.neighborhood.trim() ||
      !form.city.trim() ||
      form.state.trim().length !== 2 ||
      form.postalCode.replace(/\D/g, "").length < 8
    ) {
      setFormError(
        "Preencha destinatário, rua, número, bairro, cidade, UF (2 letras) e um CEP válido.",
      );
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const payload: AddressInput = {
        ...form,
        label: form.label?.trim() || undefined,
        complement: form.complement?.trim() || undefined,
        state: form.state.trim().toUpperCase(),
      };
      if (editingId) {
        await updateMyAddress(editingId, payload);
      } else {
        await createMyAddress(payload);
      }
      setForm(emptyForm);
      setEditingId(null);
      setStatus(editingId ? "Endereço atualizado." : "Endereço adicionado.");
      await reload();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Não foi possível salvar o endereço.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove(id: string) {
    const confirmed = window.confirm("Remover este endereço?");
    if (!confirmed) return;
    setPendingActionId(id);
    setStatus(null);
    try {
      await deleteMyAddress(id);
      setStatus("Endereço removido.");
      await reload();
    } catch (err) {
      setStatus(
        err instanceof ApiError ? err.message : "Não foi possível remover o endereço.",
      );
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleSetDefault(id: string) {
    setPendingActionId(id);
    setStatus(null);
    try {
      await setMyDefaultAddress(id);
      setStatus("Endereço padrão atualizado.");
      await reload();
    } catch (err) {
      setStatus(
        err instanceof ApiError
          ? err.message
          : "Não foi possível atualizar o endereço padrão.",
      );
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <AccountChrome
      title="Endereços"
      lead="Gerencie seus endereços de entrega."
      breadcrumbCurrent="Endereços"
    >
      {isLoading ? (
        <p role="status">Carregando…</p>
      ) : loadError ? (
        <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
          {loadError}
        </p>
      ) : (
        <>
          {!addresses || addresses.length === 0 ? (
            <p>Nenhum endereço cadastrado ainda.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
              {addresses.map((address) => (
                <li
                  key={address.id}
                  style={{
                    border: "1px solid var(--potala-border)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <p>
                    <strong>{address.label || "Endereço"}</strong>
                    {address.isDefault ? " · padrão" : ""}
                  </p>
                  <p>
                    {address.street}, {address.number}
                    {address.complement ? ` — ${address.complement}` : ""}
                  </p>
                  <p>
                    {address.neighborhood} · {address.city}/{address.state} ·{" "}
                    {address.postalCode}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button
                      type="button"
                      style={{ minHeight: 44 }}
                      onClick={() => startEdit(address)}
                    >
                      Editar
                    </button>
                    {!address.isDefault ? (
                      <button
                        type="button"
                        style={{ minHeight: 44 }}
                        disabled={pendingActionId === address.id}
                        onClick={() => handleSetDefault(address.id)}
                      >
                        Definir como padrão
                      </button>
                    ) : null}
                    <button
                      type="button"
                      style={{ minHeight: 44 }}
                      disabled={pendingActionId === address.id}
                      onClick={() => handleRemove(address.id)}
                    >
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {status ? (
            <p role="status" aria-live="polite" style={{ marginTop: 12 }}>
              {status}
            </p>
          ) : null}

          <form
            onSubmit={handleSubmit}
            style={{ display: "grid", gap: 10, maxWidth: 560, marginTop: 24 }}
          >
            <h2>{editingId ? "Editar endereço" : "Novo endereço"}</h2>
            {(
              [
                ["label", "Rótulo (opcional)"],
                ["recipient", "Destinatário"],
                ["street", "Rua"],
                ["number", "Número"],
                ["complement", "Complemento (opcional)"],
                ["neighborhood", "Bairro"],
                ["city", "Cidade"],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label htmlFor={`addr-${field}`}>{label}</label>
                <input
                  id={`addr-${field}`}
                  value={form[field] ?? ""}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, [field]: event.target.value }))
                  }
                  style={{ width: "100%", minHeight: 44 }}
                />
              </div>
            ))}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: "0 0 80px" }}>
                <label htmlFor="addr-state">UF</label>
                <input
                  id="addr-state"
                  value={form.state}
                  maxLength={2}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      state: event.target.value.toUpperCase(),
                    }))
                  }
                  style={{ width: "100%", minHeight: 44 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="addr-postal">CEP</label>
                <input
                  id="addr-postal"
                  value={form.postalCode}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, postalCode: event.target.value }))
                  }
                  style={{ width: "100%", minHeight: 44 }}
                />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={form.isDefault ?? false}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, isDefault: event.target.checked }))
                }
              />
              Definir como endereço padrão
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={isSaving} style={{ minHeight: 44 }}>
                {isSaving ? "Salvando…" : editingId ? "Salvar alterações" : "Adicionar endereço"}
              </button>
              {editingId ? (
                <button type="button" onClick={cancelEdit} style={{ minHeight: 44 }}>
                  Cancelar
                </button>
              ) : null}
            </div>
            {formError ? (
              <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
                {formError}
              </p>
            ) : null}
          </form>
        </>
      )}
    </AccountChrome>
  );
}
