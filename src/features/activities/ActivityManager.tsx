"use client";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import {
  Activity,
  ActivityPage,
  activityDate,
  activityKindLabel,
  activityPrice,
} from "@/lib/api/activities";
import s from "./activities.module.css";
import { MaterialUpload } from "./MaterialUpload";
import { ActivityParticipants } from "./ActivityParticipants";
import { ActivityDetailsEditor } from "./ActivityDetailsEditor";
export function ActivityManager({ admin = false }: { admin?: boolean }) {
  const base = admin ? "/admin/activities" : "/seller/activities";
  const [editing, setEditing] = useState<Activity | null>(null);
  function localDate(value?: string) {
    if (!value) return undefined;
    const d = new Date(value);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }
  const [rows, setRows] = useState<Activity[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [count, setCount] = useState(1);
  const [instructorCount, setInstructorCount] = useState(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null),
    [moreLoading, setMoreLoading] = useState(false);
  async function load(cursor?: string) {
    try {
      const page = await apiFetch<ActivityPage<Activity>>(
        `${base}?limit=20${cursor ? `&cursor=${cursor}` : ""}`,
      );
      setRows((prev) =>
        cursor ? [...prev, ...(page?.items ?? [])] : (page?.items ?? []),
      );
      setNextCursor(page?.pageInfo.nextCursor ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    apiFetch<ActivityPage<Activity>>(`${base}?limit=20`)
      .then((page) => {
        setRows(page?.items ?? []);
        setNextCursor(page?.pageInfo.nextCursor ?? null);
      })
      .catch((err: Error) => setError(err.message));
  }, [base]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await apiFetch(editing ? `${base}/${editing.id}` : base, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({
          title: f.get("title"),
          description: f.get("description"),
          kind: f.get("kind"),
          modality: f.get("modality") || undefined,
          venue: f.get("venue"),
          meetingUrl: f.get("meetingUrl"),
          instructors: Array.from({ length: instructorCount }, (_, i) => ({
            name: String(f.get(`instructorName${i}`) ?? "").trim(),
            bio: String(f.get(`instructorBio${i}`) ?? "").trim(),
          })).filter((i) => i.name || i.bio),
          priceCents: Number(f.get("priceCents")),
          capacity: Number(f.get("capacity")),
          timezone: f.get("timezone"),
          enrollmentDeadline: new Date(String(f.get("deadline"))).toISOString(),
          sessions: Array.from({ length: count }, (_, i) => ({
            title: f.get(`sessionTitle${i}`),
            startsAt: new Date(String(f.get(`start${i}`))).toISOString(),
            endsAt: new Date(String(f.get(`end${i}`))).toISOString(),
          })),
        }),
      });
      form.reset();
      setEditing(null);
      setCount(1);
      setInstructorCount(1);
      setMessage(
        "Atividade criada como rascunho. Adicione os materiais e publique quando estiver pronta.",
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function status(id: string, status: string) {
    if (
      status === "CANCELLED" &&
      !window.confirm(
        "Cancelar a atividade e revogar todas as inscrições e acessos?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`${base}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={s.page}>
      <h1>Gestão de atividades</h1>
      {admin && (
        <p>
          Atividades pagas devem ser cadastradas no painel da loja responsável
          pelo recebimento; aqui você pode criar atividades gratuitas e moderar
          as atividades das lojas.
        </p>
      )}
      <p>
        Cadastre cursos, eventos e encontros recorrentes. Os horários abaixo
        usam o fuso do seu dispositivo; o fuso informado será usado na exibição
        da programação.
      </p>
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" className={s.notice}>
          {message}
        </p>
      )}
      <form key={editing?.id ?? "new"} className={s.card} onSubmit={create}>
        <h2>{editing ? "Editar rascunho" : "Nova atividade"}</h2>
        <label>
          Título
          <input
            name="title"
            defaultValue={editing?.title}
            required
            minLength={3}
            maxLength={160}
          />
        </label>
        <label>
          Descrição
          <textarea
            name="description"
            defaultValue={editing?.description}
            required
            maxLength={20000}
          />
        </label>
        <label>
          Tipo
          <select name="kind" defaultValue={editing?.kind ?? "COURSE"}>
            <option value="COURSE">Curso</option>
            <option value="EVENT">Evento</option>
            <option value="RECURRING">Atividade recorrente</option>
          </select>
        </label>
        <label>
          Modalidade
          <select name="modality" defaultValue={editing?.modality ?? ""}>
            <option value="">Definir antes de publicar</option>
            <option value="IN_PERSON">Presencial</option>
            <option value="ONLINE">On-line</option>
            <option value="HYBRID">Híbrido</option>
          </select>
        </label>
        <label>
          Local e endereço (presencial ou híbrido)
          <textarea
            name="venue"
            maxLength={1000}
            defaultValue={editing?.venue ?? ""}
          />
        </label>
        <label>
          Link privado do encontro (on-line ou híbrido)
          <input
            name="meetingUrl"
            type="url"
            maxLength={2048}
            defaultValue={editing?.meetingUrl ?? ""}
          />
        </label>
        <p>
          O link deve usar HTTPS e fica disponível somente para inscrições
          confirmadas. Complete modalidade, instrutores e local ou link antes de
          publicar.
        </p>
        {Array.from({ length: instructorCount }, (_, i) => (
          <fieldset key={`instructor${i}`}>
            <legend>Instrutor {i + 1}</legend>
            <label>
              Nome
              <input
                name={`instructorName${i}`}
                maxLength={160}
                defaultValue={editing?.instructors?.[i]?.name}
              />
            </label>
            <label>
              Biografia
              <textarea
                name={`instructorBio${i}`}
                maxLength={2000}
                defaultValue={editing?.instructors?.[i]?.bio}
              />
            </label>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={instructorCount >= 20}
          onClick={() => setInstructorCount(instructorCount + 1)}
        >
          Adicionar instrutor
        </button>
        <label>
          Preço em centavos (0 para gratuito)
          <input
            name="priceCents"
            type="number"
            min={0}
            max={100000000}
            defaultValue={editing?.priceCents ?? 0}
            required
          />
        </label>
        <label>
          Capacidade
          <input
            name="capacity"
            defaultValue={editing?.capacity}
            type="number"
            min={1}
            max={100000}
            required
          />
        </label>
        <label>
          Fuso horário de exibição
          <input
            name="timezone"
            defaultValue={editing?.timezone ?? "America/Sao_Paulo"}
            required
          />
        </label>
        <label>
          Prazo de inscrição
          <input
            name="deadline"
            defaultValue={localDate(editing?.enrollmentDeadline)}
            type="datetime-local"
            required
          />
        </label>
        {Array.from({ length: count }, (_, i) => (
          <fieldset key={i}>
            <legend>Encontro {i + 1}</legend>
            <label>
              Título
              <input
                name={`sessionTitle${i}`}
                defaultValue={editing?.sessions[i]?.title}
                required
                maxLength={160}
              />
            </label>
            <label>
              Início
              <input
                type="datetime-local"
                name={`start${i}`}
                defaultValue={localDate(editing?.sessions[i]?.startsAt)}
                required
              />
            </label>
            <label>
              Fim
              <input
                type="datetime-local"
                name={`end${i}`}
                defaultValue={localDate(editing?.sessions[i]?.endsAt)}
                required
              />
            </label>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={count >= 100}
          onClick={() => setCount(count + 1)}
        >
          Adicionar encontro
        </button>
        <button disabled={busy}>Salvar rascunho</button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setCount(1);
              setInstructorCount(1);
            }}
          >
            Cancelar edição
          </button>
        )}
      </form>
      <h2>Atividades cadastradas</h2>
      {rows.length === 0 && <p>Nenhuma atividade cadastrada.</p>}
      {rows.map((a) => (
        <article key={a.id} className={s.card}>
          <h2>{a.title}</h2>
          <p>
            {activityKindLabel[a.kind]} · {activityPrice(a.priceCents)} ·{" "}
            {a.capacity} vagas ·{" "}
            {a.status === "DRAFT"
              ? "Rascunho"
              : a.status === "PUBLISHED"
                ? "Publicada"
                : "Cancelada"}
          </p>
          {a.sessions.map((x) => (
            <p key={x.id}>
              {x.title}: {activityDate(x.startsAt, a.timezone)}
            </p>
          ))}
          {a.status === "DRAFT" && (
            <button
              disabled={busy}
              onClick={() => {
                setEditing(a);
                setCount(a.sessions.length);
                setInstructorCount(Math.max(1, a.instructors?.length ?? 0));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Editar rascunho
            </button>
          )}
          <ActivityParticipants base={base} id={a.id} />
          {a.status !== "CANCELLED" && (
            <ActivityDetailsEditor key={JSON.stringify([a.modality,a.venue,a.meetingUrl,a.instructors])} activity={a} base={base} onSaved={load} />
          )}
          {a.status !== "CANCELLED" && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  status(a.id, a.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")
                }
              >
                {a.status === "PUBLISHED" ? "Suspender publicação" : "Publicar"}
              </button>
              <button disabled={busy} onClick={() => status(a.id, "CANCELLED")}>
                Cancelar atividade
              </button>
              <MaterialUpload base={base} id={a.id} />
            </>
          )}
        </article>
      ))}
      {nextCursor && (
        <button
          disabled={moreLoading}
          onClick={async () => {
            setMoreLoading(true);
            await load(nextCursor);
            setMoreLoading(false);
          }}
        >
          Carregar mais atividades
        </button>
      )}
    </main>
  );
}
