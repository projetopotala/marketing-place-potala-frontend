"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";

export function AccountActionForm({
  mode,
}: {
  mode: "forgot" | "reset" | "confirm";
}) {
  const [token, setToken] = useState("");
  const importedFragment = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (importedFragment.current) return;
    importedFragment.current = true;
    const value =
      new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    // Browser fragments are unavailable during SSR; import once after hydration.
    setToken(value);
    if (value) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  async function submit(event: FormEvent, confirmationRequest = false) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const path = confirmationRequest
        ? "/auth/email/request"
        : mode === "forgot"
          ? "/auth/password/forgot"
          : mode === "reset"
            ? "/auth/password/reset"
            : "/auth/email/confirm";
      const body =
        confirmationRequest || mode === "forgot"
          ? { email, callbackOrigin: window.location.origin }
          : mode === "reset"
            ? { token, password }
            : { token };
      const result = await apiFetch<{ message?: string }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessage(
        result?.message ||
          (mode === "reset"
            ? "Senha alterada. Entre novamente com sua nova senha."
            : "E-mail confirmado. Você já pode entrar."),
      );
      setDone(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  const request = mode === "forgot" || (mode === "confirm" && !token);
  return (
    <section style={{ maxWidth: 480, margin: "64px auto", padding: 24 }}>
      <h1>
        {mode === "forgot"
          ? "Recuperar senha"
          : mode === "reset"
            ? "Definir nova senha"
            : "Confirmar e-mail"}
      </h1>
      <form
        onSubmit={(event) => submit(event, mode === "confirm" && !token)}
        style={{ display: "grid", gap: 16, marginTop: 24 }}
      >
        {request && (
          <label>
            E-mail
            <input
              required
              type="email"
              maxLength={255}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                padding: 12,
                border: "1px solid #aaa",
              }}
            />
          </label>
        )}
        {mode === "reset" && (
          <label>
            Nova senha
            <input
              required
              type="password"
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                padding: 12,
                border: "1px solid #aaa",
              }}
            />
          </label>
        )}
        {mode === "reset" && !token && (
          <p>Abra o link recebido por e-mail para continuar.</p>
        )}
        <button
          disabled={busy || done || (mode === "reset" && !token)}
          style={{ padding: 12, background: "#6f522c", color: "white" }}
        >
          {busy
            ? "Aguarde…"
            : request
              ? "Solicitar instruções"
              : mode === "reset"
                ? "Salvar nova senha"
                : "Confirmar meu e-mail"}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
      <p style={{ marginTop: 24 }}>
        <Link href="/">Voltar à loja</Link>
      </p>
    </section>
  );
}
