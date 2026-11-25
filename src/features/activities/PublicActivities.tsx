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
import { ApiError } from "@/lib/api/client";

function activityLoadError(error: unknown) {
  return error instanceof ApiError && error.status >= 500
    ? "Não foi possível carregar as atividades agora. Tente novamente em instantes."
    : error instanceof Error ? error.message : "Não foi possível carregar as atividades.";
}

export function ActivityList({ kind }: { kind?: ActivityKind }) {
  const [attempt, setAttempt] = useState(0);
  const key = `${kind ?? "ALL"}:${attempt}`;
  const [result, setResult] = useState<{key: string; items: Activity[]; nextCursor: string | null; error: string} | null>(null);
  const [moreLoading, setMoreLoading] = useState(false);
  const loading = result?.key !== key;
  const items = loading ? [] : result.items;
  const error = loading ? "" : result.error;
  const nextCursor = loading ? null : result.nextCursor;
  async function loadMore() {
    if (!nextCursor || moreLoading) return;
    setMoreLoading(true);
    try {
      const page = await activityApi.list(kind, nextCursor);
      setResult(prev => prev?.key === key ? {...prev, items: [...prev.items, ...(page?.items ?? [])], nextCursor: page?.pageInfo.nextCursor ?? null, error: ""} : prev);
    } catch (e) {
      setResult(prev => prev?.key === key ? {...prev, error: activityLoadError(e)} : prev);
    } finally {
      setMoreLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    activityApi
      .list(kind)
      .then((page) => {
        if (active) setResult({key, items: page?.items ?? [], nextCursor: page?.pageInfo.nextCursor ?? null, error: ""});
      })
      .catch((e) => {if (active) setResult({key, items: [], nextCursor: null, error: activityLoadError(e)});});
    return () => {active = false;};
  }, [kind, key]);
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
        <Link href="/eventos">Eventos</Link>
        <Link href="/atividades">Atividades recorrentes</Link>
        <Link href="/minha-conta/inscricoes">Minhas inscrições</Link>
      </nav>
      {error && (
        <div role="alert" className={s.error}>
          <p>{error}</p>
          <button type="button" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button>
        </div>
      )}
      {loading ? (
        <p>Carregando atividades…</p>
      ) : error && !items.length ? null : !items.length ? (
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
      <Link href="/eventos">Explorar atividades</Link>
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
