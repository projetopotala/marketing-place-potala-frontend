"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  activityApi,
  Activity,
  ActivityKind,
  activityDate,
  activityPrice,
  activityKindLabel,
  activityModalityLabel,
} from "@/lib/api/activities";
import s from "./activities.module.css";
import { trackAnalyticsEvent } from "@/lib/analytics";
export function ActivityList({ kind }: { kind?: ActivityKind }) {
  const [items, setItems] = useState<Activity[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null),
    [moreLoading, setMoreLoading] = useState(false);
  async function loadMore() {
    if (!nextCursor) return;
    setMoreLoading(true);
    try {
      const page = await activityApi.list(kind, nextCursor);
      setItems((prev) => [...prev, ...(page?.items ?? [])]);
      setNextCursor(page?.pageInfo.nextCursor ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMoreLoading(false);
    }
  }
  useEffect(() => {
    activityApi
      .list(kind)
      .then((page) => {
        setItems(page?.items ?? []);
        setNextCursor(page?.pageInfo.nextCursor ?? null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [kind]);
  return (
    <main className={s.page}>
      <h1>
        {kind === "COURSE"
          ? "Cursos"
          : kind === "EVENT"
            ? "Eventos"
            : "Atividades recorrentes"}
      </h1>
      <nav>
        <Link href="/cursos">Cursos</Link>
        <Link href="/eventos">Eventos</Link>
        <Link href="/atividades">Atividades recorrentes</Link>
        <Link href="/minha-conta/inscricoes">Minhas inscrições</Link>
      </nav>
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      {loading ? (
        <p>Carregando atividades…</p>
      ) : !items.length ? (
        <p>Nenhuma atividade publicada neste momento.</p>
      ) : (
        <div className={s.grid}>
          {items.map((a) => (
            <article className={s.card} key={a.id}>
              <small>{activityKindLabel[a.kind]}</small>
              <h2>
                <Link href={`/atividades/${a.id}`}>{a.title}</Link>
              </h2>
              <p>{a.description.slice(0, 200)}</p>
              <strong>{activityPrice(a.priceCents)}</strong>
              <p>
                {a.sessions[0] &&
                  activityDate(a.sessions[0].startsAt, a.timezone)}
              </p>
              <Link href={`/atividades/${a.id}`}>
                Ver programação e inscrição
              </Link>
            </article>
          ))}
        </div>
      )}
      {nextCursor && (
        <button disabled={moreLoading} onClick={loadMore}>
          {moreLoading ? "Carregando…" : "Carregar mais atividades"}
        </button>
      )}
    </main>
  );
}
export function ActivityDetail({ id }: { id: string }) {
  const [a, setA] = useState<Activity | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    activityApi
      .get(id)
      .then(setA)
      .catch((e) => setError(e.message));
  }, [id]);
  async function enroll() {
    setBusy(true);
    setError("");
    try {
      const e = await activityApi.enroll(id);
      trackAnalyticsEvent("enroll", { activityId: id });
      setMessage(
        e?.status === "CONFIRMED"
          ? "Inscrição confirmada. Consulte sua agenda e seus materiais."
          : "Vaga reservada por até 30 minutos. Acesse Minhas inscrições para verificar o pagamento.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={s.page}>
      <Link href="/cursos">Explorar atividades</Link>
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      {!a ? (
        <p>Carregando…</p>
      ) : (
        <>
          <h1>{a.title}</h1>
          <small>
            {activityKindLabel[a.kind]} · {a.timezone}
          </small>
          <p>{a.description}</p>
          {a.modality && <p>Modalidade: {activityModalityLabel[a.modality]}</p>}
          {a.venue && a.modality !== "ONLINE" && <p>Local: {a.venue}</p>}
          {!!a.instructors?.length && (
            <section>
              <h2>Instrutores</h2>
              {a.instructors.map((instructor, i) => (
                <div key={i}>
                  <h3>{instructor.name}</h3>
                  <p>{instructor.bio}</p>
                </div>
              ))}
            </section>
          )}
          <p>
            <strong>{activityPrice(a.priceCents)}</strong> · Capacidade:{" "}
            {a.capacity} participantes
          </p>
          <p>Inscrições até {activityDate(a.enrollmentDeadline, a.timezone)}</p>
          <h2>Programação</h2>
          {a.sessions.map((session) => (
            <div key={session.id} className={s.card}>
              <strong>{session.title}</strong>
              <p>
                {activityDate(session.startsAt, a.timezone)} —{" "}
                {activityDate(session.endsAt, a.timezone)}
              </p>
            </div>
          ))}
          <button
            disabled={busy || new Date(a.enrollmentDeadline) <= new Date()}
            onClick={enroll}
          >
            {busy ? "Inscrevendo…" : "Inscrever-me"}
          </button>
          {message && (
            <p role="status" className={s.notice}>
              {message}{" "}
              <Link href="/minha-conta/inscricoes">Minhas inscrições</Link>
            </p>
          )}
        </>
      )}
    </main>
  );
}
