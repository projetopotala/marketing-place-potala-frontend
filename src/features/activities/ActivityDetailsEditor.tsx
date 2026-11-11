"use client";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api/client";
import type { Activity } from "@/lib/api/activities";

export function ActivityDetailsEditor({
  activity,
  base,
  onSaved,
}: {
  activity: Activity;
  base: string;
  onSaved: () => Promise<void>;
}) {
  const [count, setCount] = useState(
    Math.max(1, activity.instructors?.length ?? 0),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await apiFetch(`${base}/${activity.id}/details`, {
        method: "PATCH",
        body: JSON.stringify({
          modality: form.get("modality") || null,
          venue: form.get("venue"),
          meetingUrl: form.get("meetingUrl"),
          instructors: Array.from({ length: count }, (_, i) => ({
            name: String(form.get(`name${i}`) ?? "").trim(),
            bio: String(form.get(`bio${i}`) ?? "").trim(),
          })).filter((i) => i.name || i.bio),
        }),
      });
      await onSaved();
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao salvar detalhes.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Editar instrutores, modalidade e acesso</summary>
      <p>
        Você pode completar estes dados mesmo com inscrições existentes. Para
        atividades publicadas, mantenha os instrutores e os dados exigidos pela
        modalidade.
      </p>
      <form onSubmit={save}>
      <fieldset disabled={busy}>
      <legend>Detalhes da atividade</legend>
        <label>
          Modalidade
          <select name="modality" defaultValue={activity.modality ?? ""}>
            <option value="">Definir antes de publicar</option>
            <option value="IN_PERSON">Presencial</option>
            <option value="ONLINE">On-line</option>
            <option value="HYBRID">Híbrido</option>
          </select>
        </label>
        <label>
          Local e endereço
          <textarea
            name="venue"
            maxLength={1000}
            defaultValue={activity.venue ?? ""}
          />
        </label>
        <label>
          Link privado do encontro
          <input
            name="meetingUrl"
            type="url"
            maxLength={2048}
            defaultValue={activity.meetingUrl ?? ""}
          />
        </label>
        <p>
          Use HTTPS. O link fica disponível somente para inscrições confirmadas.
        </p>
        {Array.from({ length: count }, (_, i) => (
          <fieldset key={i}>
            <legend>Instrutor {i + 1}</legend>
            <label>
              Nome
              <input
                name={`name${i}`}
                maxLength={160}
                defaultValue={activity.instructors?.[i]?.name}
              />
            </label>
            <label>
              Biografia
              <textarea
                name={`bio${i}`}
                maxLength={2000}
                defaultValue={activity.instructors?.[i]?.bio}
              />
            </label>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={count >= 20 || busy}
          onClick={() => setCount(count + 1)}
        >
          Adicionar instrutor
        </button>
        <button disabled={busy}>Salvar detalhes</button>
      </fieldset>
        {error && <p role="alert">{error}</p>}
        {saved && <p role="status">Detalhes salvos.</p>}
      </form>
    </details>
  );
}
