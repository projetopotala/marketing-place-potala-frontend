"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { ActivityPage, activityDate } from "@/lib/api/activities";
interface Participant {
  id: string;
  userId: string;
  status: string;
  createdAt: string;
}
export function ActivityParticipants({
  base,
  id,
}: {
  base: string;
  id: string;
}) {
  const [rows, setRows] = useState<Participant[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  async function load(cursor?: string) {
    setBusy(true);
    setError("");
    try {
      const page = await apiFetch<ActivityPage<Participant>>(
        `${base}/${id}/enrollments?limit=20${cursor ? `&cursor=${cursor}` : ""}`,
      );
      setRows((prev) =>
        cursor
          ? [...(prev ?? []), ...(page?.items ?? [])]
          : (page?.items ?? []),
      );
      setNextCursor(page?.pageInfo.nextCursor ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(e: Participant) {
    if (
      !window.confirm(
        "Revogar inscrição e acesso aos materiais? Pagamentos aprovados exigem tratamento de estorno pela equipe financeira.",
      )
    )
      return;
    setBusy(true);
    try {
      await apiFetch(`${base}/${id}/enrollments/${e.id}/revoke`, {
        method: "POST",
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Inscrições e controle de acesso</summary>
      <button disabled={busy} onClick={() => load()}>
        Carregar inscrições
      </button>
      {error && <p role="alert">{error}</p>}
      {rows?.length === 0 && <p>Nenhuma inscrição.</p>}
      {rows?.map((e) => (
        <div key={e.id}>
          <p>
            Participante {e.userId} ·{" "}
            {e.status === "CONFIRMED"
              ? "Confirmada"
              : e.status === "CANCELLED"
                ? "Cancelada"
                : e.status === "EXPIRED"
                  ? "Reserva expirada"
                  : "Aguardando pagamento"}{" "}
            · {activityDate(e.createdAt)}
          </p>
          {e.status !== "CANCELLED" && e.status !== "EXPIRED" && (
            <button disabled={busy} onClick={() => revoke(e)}>
              Revogar acesso
            </button>
          )}
        </div>
      ))}
      {nextCursor && (
        <button disabled={busy} onClick={() => load(nextCursor)}>
          Carregar mais inscrições
        </button>
      )}
    </details>
  );
}
