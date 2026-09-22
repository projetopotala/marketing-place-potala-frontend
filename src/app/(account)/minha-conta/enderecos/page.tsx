"use client";

import { useState, type FormEvent } from "react";
import { AccountChrome } from "@/components/account/AccountChrome";
import { useAccountData } from "@/features/account/AccountDataContext";
import type { CustomerAddress } from "@/features/account/domain";

const emptyForm = {
  label: "",
  recipient: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  cep: "",
  isDefault: false,
};

export default function AccountAddressesPage() {
  const {
    db,
    isHydrated,
    saveAddress,
    removeAddress,
    setDefaultAddress,
  } = useAccountData();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  function startEdit(address: CustomerAddress) {
    setEditingId(address.id);
    setForm({
      label: address.label,
      recipient: address.recipient,
      street: address.street,
      number: address.number,
      complement: address.complement ?? "",
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      cep: address.cep,
      isDefault: address.isDefault,
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.label.trim() || !form.street.trim() || !form.number.trim()) {
      setStatus("Preencha rótulo, rua e número.");
      return;
    }
    saveAddress({
      ...form,
      id: editingId ?? undefined,
      complement: form.complement || undefined,
    });
    setForm(emptyForm);
    setEditingId(null);
    setStatus(editingId ? "Endereço atualizado." : "Endereço adicionado.");
  }

  function handleRemove(id: string) {
    const confirmed = window.confirm("Remover este endereço?");
    if (!confirmed) return;
    try {
      removeAddress(id);
      setStatus("Endereço removido.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível remover.");
    }
  }

  return (
    <AccountChrome
      title="Endereços"
      lead="Gerencie seus endereços de entrega (salvos localmente nesta demonstração)."
      breadcrumbCurrent="Endereços"
    >
      {!isHydrated || !db ? (
        <p role="status">Carregando…</p>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
            {db.addresses.map((address) => (
              <li
                key={address.id}
                style={{
                  border: "1px solid var(--potala-border)",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <p>
                  <strong>{address.label}</strong>
                  {address.isDefault ? " · padrão" : ""}
                </p>
                <p>
                  {address.street}, {address.number}
                  {address.complement ? ` — ${address.complement}` : ""}
                </p>
                <p>
                  {address.neighborhood} · {address.city}/{address.state} ·{" "}
                  {address.cep}
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
                      onClick={() => {
                        setDefaultAddress(address.id);
                        setStatus("Endereço padrão atualizado.");
                      }}
                    >
                      Definir como padrão
                    </button>
                  ) : null}
                  <button
                    type="button"
                    style={{ minHeight: 44 }}
                    onClick={() => handleRemove(address.id)}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <form
            onSubmit={handleSubmit}
            style={{ display: "grid", gap: 10, maxWidth: 560, marginTop: 24 }}
          >
            <h2>{editingId ? "Editar endereço" : "Novo endereço"}</h2>
            {(
              [
                ["label", "Rótulo"],
                ["recipient", "Destinatário"],
                ["street", "Rua"],
                ["number", "Número"],
                ["complement", "Complemento"],
                ["neighborhood", "Bairro"],
                ["city", "Cidade"],
                ["state", "UF"],
                ["cep", "CEP"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label htmlFor={`addr-${key}`}>{label}</label>
                <input
                  id={`addr-${key}`}
                  value={form[key]}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  style={{ width: "100%", minHeight: 44 }}
                />
              </div>
            ))}
            <label style={{ display: "flex", gap: 8, minHeight: 44, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isDefault: event.target.checked,
                  }))
                }
              />
              Definir como padrão
            </label>
            <button type="submit" style={{ minHeight: 44 }}>
              Salvar
            </button>
          </form>

          {status ? (
            <p role="status" aria-live="polite">
              {status}
            </p>
          ) : null}
        </>
      )}
    </AccountChrome>
  );
}
