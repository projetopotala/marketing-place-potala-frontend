"use client";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api/client";
export function MaterialUpload({ base, id }: { base: string; id: string }) {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      fields = new FormData(form),
      file = fields.get("file");
    setError("");
    setMessage("");
    if (!(file instanceof File) || !file.size) {
      setError("Selecione um arquivo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Limite de 5 MiB por arquivo.");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mimes: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      txt: "text/plain",
    };
    const mimeType = mimes[extension];
    if (!mimeType) {
      setError("Use PDF, PNG, JPEG ou TXT.");
      return;
    }
    const stem =
      file.name
        .slice(0, -extension.length - 1)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 80) || "material";
    const filename = `${stem}.${extension}`;
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () =>
          reject(new Error("Falha na leitura do arquivo."));
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.readAsDataURL(file);
      });
      await apiFetch(`${base}/${id}/materials`, {
        method: "POST",
        body: JSON.stringify({
          title: fields.get("title"),
          filename,
          mimeType,
          base64,
        }),
      });
      form.reset();
      setMessage(
        `Arquivo ${filename} salvo. Participantes confirmados poderão baixá-lo em Meus materiais.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Adicionar arquivo protegido</summary>
      <p>
        PDF sem conteúdo ativo, PNG, JPEG ou TXT UTF-8. Limite de 5 MiB por
        arquivo. A entrega exige inscrição confirmada e registra cada acesso.
      </p>
      <form onSubmit={submit}>
        <label>
          Título
          <input name="title" required maxLength={160} />
        </label>
        <label>
          Arquivo
          <input
            name="file"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt"
            required
          />
        </label>
        <button disabled={busy}>
          {busy ? "Enviando…" : "Enviar material"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
