"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  activityApi,
  Enrollment,
  Material,
  activityDate,
} from "@/lib/api/activities";
import { API_BASE_URL } from "@/lib/api/config";
import s from "./activities.module.css";
import { trackAnalyticsEvent } from "@/lib/analytics";
const labels = {
  CONFIRMED: "Confirmada",
  PENDING_PAYMENT: "Aguardando pagamento",
  CANCELLED: "Cancelada",
  EXPIRED: "Reserva expirada",
};
export function MyActivities({
  view = "enrollments",
}: {
  view?: "enrollments" | "agenda" | "downloads";
}) {
  const [rows, setRows] = useState<Enrollment[]>([]),
    [materials, setMaterials] = useState<Record<string, Material[]>>({}),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null),
    [moreLoading, setMoreLoading] = useState(false);
  async function load(cursor?: string) {
    try {
      const page = await activityApi.mine(cursor);
      setRows((prev) =>
        cursor ? [...prev, ...(page?.items ?? [])] : (page?.items ?? []),
      );
      setNextCursor(page?.pageInfo.nextCursor ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function action(e: Enrollment, type: "cancel" | "pay" | "materials") {
    setBusy(e.id);
    setError("");
    try {
      if (type === "materials") {
        const m = await activityApi.materials(e.id);
        setMaterials((prev) => ({ ...prev, [e.id]: m ?? [] }));
      } else if (type === "cancel") {
        if (
          !window.confirm(
            "Cancelar inscrição? O acesso aos materiais será revogado.",
          )
        )
          return;
        await activityApi.cancel(e.id);
        await load();
      } else {
        await activityApi.pay(e.id);
        await load();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }
  const shown =
    view === "enrollments"
      ? rows
      : rows.filter((r) => r.status === "CONFIRMED");
  return (
    <section className={s.page}>
      <h1>
        {view === "agenda"
          ? "Minha agenda"
          : view === "downloads"
            ? "Meus materiais e downloads"
            : "Minhas inscrições"}
      </h1>
      <nav>
        <Link href="/minha-conta/inscricoes">Inscrições</Link>
        <Link href="/minha-conta/agenda">Agenda</Link>
        <Link href="/minha-conta/downloads">Materiais</Link>
        <Link href="/cursos">Explorar cursos</Link>
      </nav>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p>Carregando…</p>
      ) : !shown.length ? (
        <p>
          Nenhuma inscrição {view === "enrollments" ? "" : "confirmada "}
          encontrada.
        </p>
      ) : (
        shown.map((e) => (
          <article key={e.id} className={s.card}>
            <h2>{e.activity.title}</h2>
            <strong>{labels[e.status]}</strong>
            {e.expiresAt && e.status === "PENDING_PAYMENT" && (
              <p>
                Reserva até {activityDate(e.expiresAt, e.activity.timezone)}. A
                confirmação depende de pagamento aprovado.
              </p>
            )}
            {e.status === "EXPIRED" && (
              <p>
                A reserva anterior foi encerrada.{" "}
                <Link href={`/atividades/${e.activityId}`}>
                  Tentar nova inscrição
                </Link>{" "}
                (sujeita a vagas e prazo).
              </p>
            )}
            {view === "agenda" &&
              e.activity.sessions.map((session) => (
                <p key={session.id}>
                  {session.title}:{" "}
                  {activityDate(session.startsAt, e.activity.timezone)} até{" "}
                  {activityDate(session.endsAt, e.activity.timezone)} (
                  {e.activity.timezone})
                </p>
              ))}
            {view !== "agenda" && e.status === "CONFIRMED" && (
              <button
                disabled={busy === e.id}
                onClick={() => action(e, "materials")}
              >
                Consultar materiais
              </button>
            )}
            {e.status === "PENDING_PAYMENT" && (
              <button disabled={busy === e.id} onClick={() => action(e, "pay")}>
                Verificar pagamento
              </button>
            )}
            {view === "enrollments" &&
              e.status !== "CANCELLED" &&
              e.status !== "EXPIRED" && (
                <button
                  disabled={busy === e.id}
                  onClick={() => action(e, "cancel")}
                >
                  Cancelar inscrição
                </button>
              )}
            {materials[e.id] && (
              <ul>
                {materials[e.id].length ? (
                  materials[e.id].map((m) => (
                    <li key={m.id}>
                      <a
                        onClick={() =>
                          trackAnalyticsEvent("download", {
                            activityId: e.activityId,
                          })
                        }
                        href={`${API_BASE_URL}/me/enrollments/${e.id}/materials/${m.id}/download`}
                      >
                        {m.title} ({m.filename})
                      </a>
                    </li>
                  ))
                ) : (
                  <li>Nenhum material disponibilizado.</li>
                )}
              </ul>
            )}
          </article>
        ))
      )}
      {nextCursor && (
        <button
          disabled={moreLoading}
          onClick={async () => {
            setMoreLoading(true);
            await load(nextCursor);
            setMoreLoading(false);
          }}
        >
          Carregar mais inscrições
        </button>
      )}
    </section>
  );
}
