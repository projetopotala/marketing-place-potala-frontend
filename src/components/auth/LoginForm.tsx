"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/components/auth/PasswordField";
import { useAuth } from "@/context/AuthContext";
import { UserIcon } from "@/components/storefront/icons";
import styles from "./LoginForm.module.css";

interface LoginFormProps {
  initialEmail?: string;
  bannerMessage?: string | null;
  onCreateAccount: () => void;
}

export function LoginForm({
  initialEmail = "",
  bannerMessage = null,
  onCreateAccount,
}: LoginFormProps) {
  const router = useRouter();
  const { signIn } = useAuth();
  const formId = useId();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  // "Lembrar de mim" segue na UI, mas não é mais enviado ao backend: a sessão
  // (cookie HttpOnly emitido por identity-service) tem um único TTL fixo
  // (SESSION_TTL_DAYS) independente dessa escolha — não existe hoje uma
  // sessão "de navegador" mais curta no backend para alternar.
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function attemptSignIn() {
    if (isSubmitting) return;
    setError(null);

    if (!email.trim() || !password) {
      setError("Informe e-mail e senha.");
      return;
    }

    setIsSubmitting(true);
    const result = await signIn({ email, password });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(
      result.role === "admin"
        ? "/admin"
        : result.role === "seller"
          ? "/loja"
          : "/minha-conta",
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void attemptSignIn();
  }

  return (
    <div className={styles.card}>
      <div className={styles.icon} aria-hidden="true">
        <UserIcon className="h-7 w-7" />
      </div>
      <h1 id="access-title" className={styles.title} tabIndex={-1}>
        Entrar
      </h1>
      <p className={styles.lead}>
        Acesse sua conta para acompanhar pedidos, favoritos e preferências.
      </p>

      {bannerMessage ? (
        <p role="status" className={styles.banner}>
          {bannerMessage}
        </p>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor={`${formId}-email`}>E-mail</label>
          <input
            id={`${formId}-email`}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(error)}
          />
        </div>

        <PasswordField
          id={`${formId}-password`}
          label="Senha"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          Lembrar de mim
        </label>

        {/* type=button evita submit nativo antes da hidratação (URL /acesso?). */}
        <button
          type="button"
          className={styles.primary}
          onClick={() => void attemptSignIn()}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? "Entrando…" : "Entrar"}
        </button>

        <button type="button" className={styles.disabled} disabled>
          Esqueci minha senha · Disponível em breve
        </button>

        {error ? (
          <p role="status" className={styles.error}>
            {error}
          </p>
        ) : null}
      </form>

      <div className={styles.divider} aria-hidden="true" />

      <p className={styles.switchText}>Ainda não tem uma conta?</p>
      <button type="button" className={styles.switchBtn} onClick={onCreateAccount}>
        Criar conta
      </button>
    </div>
  );
}
