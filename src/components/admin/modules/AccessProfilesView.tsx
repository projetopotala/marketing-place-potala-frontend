"use client";
import { useEffect, useState, FormEvent } from "react";
import { apiFetch } from "@/lib/api/client";
type Access = {
  permissions: string[];
  roles: { id: string; slot: number; name: string; permissions: string[] }[];
  grants: {
    id: string;
    userId: string;
    roleId: string;
    scopeType: string;
    sellerIds: string[];
    expiresAt: string | null;
  }[];
};
export function AccessProfilesView() {
  const [data, setData] = useState<Access | null>(null);
  const [error, setError] = useState("");
  const [slot, setSlot] = useState(1);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [scopeType, setScopeType] = useState("SELLERS");
  const [sellerIds, setSellerIds] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const result = await apiFetch<Access>("/admin/access");
    setData(result);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      await apiFetch(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }
  function save(e: FormEvent) {
    e.preventDefault();
    void mutate(`/admin/access/roles/${slot}`, "PUT", { name, permissions });
  }
  return (
    <section style={{ padding: 24, display: "grid", gap: 20 }}>
      <h1>Perfis e concessões administrativas</h1>
      <p>
        Até cinco perfis configuráveis. Alterações valem na próxima requisição.
        Somente superadministradores gerenciam acessos.
      </p>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <form onSubmit={save}>
            <h2>Perfil</h2>
            <label>
              Posição{" "}
              <select
                value={slot}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setSlot(n);
                  const role = data.roles.find((r) => r.slot === n);
                  setName(role?.name ?? "");
                  setPermissions(role?.permissions ?? []);
                }}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>{" "}
            <label>
              Nome{" "}
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <fieldset>
              <legend>Permissões</legend>
              {data.permissions.map((p) => (
                <label key={p} style={{ display: "block" }}>
                  <input
                    type="checkbox"
                    checked={permissions.includes(p)}
                    onChange={(e) =>
                      setPermissions(
                        e.target.checked
                          ? [...permissions, p]
                          : permissions.filter((v) => v !== p),
                      )
                    }
                  />
                  {p}
                </label>
              ))}
            </fieldset>
            <button disabled={busy || !permissions.length}>
              Salvar perfil
            </button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void mutate("/admin/access/grants", "POST", {
                userId,
                roleId,
                scopeType,
                sellerIds:
                  scopeType === "GLOBAL"
                    ? []
                    : sellerIds
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                ...(expiresAt
                  ? { expiresAt: new Date(expiresAt).toISOString() }
                  : {}),
              });
            }}
          >
            <h2>Conceder a administrador existente</h2>
            <label>
              UUID do usuário{" "}
              <input
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </label>
            <label>
              Perfil{" "}
              <select
                required
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="">Selecione</option>
                {data.roles.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Escopo{" "}
              <select
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value)}
              >
                <option value="SELLERS">Lojas específicas</option>
                <option value="GLOBAL">Global</option>
              </select>
            </label>
            {scopeType === "SELLERS" && (
              <label>
                UUIDs das lojas, separados por vírgula{" "}
                <input
                  required
                  value={sellerIds}
                  onChange={(e) => setSellerIds(e.target.value)}
                />
              </label>
            )}
            <label>
              Expiração opcional{" "}
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </label>
            <button disabled={busy}>Conceder</button>
          </form>
          <h2>Concessões vigentes</h2>
          {data.grants.map((g) => (
            <div key={g.id}>
              {g.userId} · {data.roles.find((r) => r.id === g.roleId)?.name} ·{" "}
              {g.scopeType} {g.sellerIds.join(", ")} ·{" "}
              {g.expiresAt ?? "sem expiração"}{" "}
              <button
                disabled={busy}
                onClick={() => mutate(`/admin/access/grants/${g.id}`, "DELETE")}
              >
                Revogar
              </button>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
