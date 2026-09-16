"use client";

import { useId, useState, type FormEvent } from "react";
import { PasswordField } from "@/components/auth/PasswordField";
import { useAuth } from "@/context/AuthContext";
import { UserIcon } from "@/components/storefront/icons";
import { MIN_PASSWORD_LENGTH } from "@/types/auth";
import styles from "./RegisterForm.module.css";

interface RegisterFormProps {
  onBackToLogin: (email: string, message?: string | null) => void;
}

export function RegisterForm({ onBackToLogin }: RegisterFormProps) {
  const { signUp } = useAuth();
  const formId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors: Record<string, string> = {};

    if (!name.trim()) nextErrors.name = "Informe seu nome completo.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Informe um e-mail válido.";
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "As senhas não coincidem.";
    }
    if (!terms) nextErrors.terms = "Aceite os termos para continuar.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus(null);
      return;
    }

    setIsSubmitting(true);
    const result = await signUp({
      name,
      email,
      phone: phone.trim() || undefined,
      password,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setStatus(result.error);
      return;
    }

    setStatus(null);
    onBackToLogin(
      email.trim().toLowerCase(),
      "Conta criada com sucesso. Entre para acessar seu painel.",
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.icon} aria-hidden="true">
        <UserIcon className="h-7 w-7" />
      </div>
      <h1 id="access-title" className={styles.title} tabIndex={-1}>
        Criar conta
      </h1>
      <p className={styles.lead}>
        Cadastre-se para acompanhar pedidos e conteúdos do Instituto Potala.
      </p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor={`${formId}-name`}>Nome completo</label>
          <input
            id={`${formId}-name`}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${formId}-name-error` : undefined}
          />
          {errors.name ? (
            <p id={`${formId}-name-error`} className={styles.error}>
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${formId}-email`}>E-mail</label>
          <input
            id={`${formId}-email`}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? `${formId}-email-error` : undefined}
          />
          {errors.email ? (
            <p id={`${formId}-email-error`} className={styles.error}>
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${formId}-phone`}>Telefone (opcional)</label>
          <input
            id={`${formId}-phone`}
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>

        <PasswordField
          id={`${formId}-password`}
          label="Senha"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={errors.password}
        />

        <PasswordField
          id={`${formId}-confirm`}
          label="Confirmar senha"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          error={errors.confirmPassword}
        />

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
            aria-invalid={Boolean(errors.terms)}
          />
          Aceito os termos e a política de privacidade
        </label>
        {errors.terms ? <p className={styles.error}>{errors.terms}</p> : null}

        <button
          type="submit"
          className={styles.primary}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? "Criando conta…" : "Criar conta"}
        </button>

        {status ? (
          <p role="status" className={styles.status}>
            {status}
          </p>
        ) : null}
      </form>

      <div className={styles.divider} aria-hidden="true" />
      <p className={styles.switchText}>Já tem uma conta?</p>
      <button
        type="button"
        className={styles.switchBtn}
        onClick={() => onBackToLogin(email.trim().toLowerCase())}
      >
        Entrar
      </button>
    </div>
  );
}
