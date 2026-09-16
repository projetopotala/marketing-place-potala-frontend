"use client";

import { useId, useState, type FormEvent } from "react";
import { PasswordField } from "@/components/auth/PasswordField";
import { registerSeller, type SellerDocumentType } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { UserIcon } from "@/components/storefront/icons";
import { MIN_PASSWORD_LENGTH } from "@/types/auth";
import styles from "./RegisterForm.module.css";

interface SellerRegisterFormProps {
  onBackToLogin: (email: string, message?: string | null) => void;
}

function registerSellerErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return "Este e-mail já está cadastrado.";
    if (error.status === 400) return error.message || "Verifique os dados informados.";
    if (error.status > 0) return error.message;
  }
  return "Não foi possível conectar ao servidor. Tente novamente.";
}

/**
 * Mirrors identity-service's RegisterSellerDto (register-seller.dto.ts) —
 * duas fases no backend (User local + handoff síncrono pra sellers-service
 * criar a loja como PENDING), mas uma chamada só daqui. Não faz login
 * automático: a conta fica pendente de aprovação do admin até
 * GET /seller/onboarding/status responder canOperate: true — ver
 * SellerAuthGuard.
 */
export function SellerRegisterForm({ onBackToLogin }: SellerRegisterFormProps) {
  const formId = useId();
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [documentType, setDocumentType] = useState<SellerDocumentType>("CPF");
  const [documentNumber, setDocumentNumber] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors: Record<string, string> = {};

    if (!ownerName.trim()) nextErrors.ownerName = "Informe o nome do responsável.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Informe um e-mail válido.";
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "As senhas não coincidem.";
    }
    if (!legalName.trim()) nextErrors.legalName = "Informe a razão social.";
    if (!tradeName.trim()) nextErrors.tradeName = "Informe o nome da loja.";
    const documentDigits = documentNumber.replace(/\D/g, "");
    const expectedDigits = documentType === "CPF" ? 11 : 14;
    if (documentDigits.length !== expectedDigits) {
      nextErrors.documentNumber =
        documentType === "CPF"
          ? "CPF deve ter 11 dígitos."
          : "CNPJ deve ter 14 dígitos.";
    }
    if (!storeEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(storeEmail)) {
      nextErrors.storeEmail = "Informe um e-mail de contato válido para a loja.";
    }
    if (phone.trim().length < 8) nextErrors.phone = "Informe um telefone válido.";
    if (!terms) nextErrors.terms = "Aceite os termos para continuar.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus(null);
      return;
    }

    setIsSubmitting(true);
    try {
      await registerSeller({
        email: email.trim().toLowerCase(),
        password,
        ownerName: ownerName.trim(),
        legalName: legalName.trim(),
        tradeName: tradeName.trim(),
        documentType,
        documentNumber: documentDigits,
        storeEmail: storeEmail.trim().toLowerCase(),
        phone: phone.trim(),
        description: description.trim() || undefined,
      });
      onBackToLogin(
        email.trim().toLowerCase(),
        "Cadastro enviado! Sua loja está em análise — entre para acompanhar o status.",
      );
    } catch (error) {
      setStatus(registerSellerErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.icon} aria-hidden="true">
        <UserIcon className="h-7 w-7" />
      </div>
      <h1 id="access-title" className={styles.title} tabIndex={-1}>
        Cadastrar loja
      </h1>
      <p className={styles.lead}>
        Cadastre sua loja no Instituto Potala. O acesso ao painel é liberado
        depois da aprovação do time.
      </p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor={`${formId}-owner`}>Seu nome completo</label>
          <input
            id={`${formId}-owner`}
            required
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
            aria-invalid={Boolean(errors.ownerName)}
          />
          {errors.ownerName ? <p className={styles.error}>{errors.ownerName}</p> : null}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${formId}-email`}>Seu e-mail (login)</label>
          <input
            id={`${formId}-email`}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email ? <p className={styles.error}>{errors.email}</p> : null}
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

        <div className={styles.field}>
          <label htmlFor={`${formId}-legal-name`}>Razão social</label>
          <input
            id={`${formId}-legal-name`}
            required
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
            aria-invalid={Boolean(errors.legalName)}
          />
          {errors.legalName ? <p className={styles.error}>{errors.legalName}</p> : null}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${formId}-trade-name`}>Nome da loja</label>
          <input
            id={`${formId}-trade-name`}
            required
            value={tradeName}
            onChange={(event) => setTradeName(event.target.value)}
            aria-invalid={Boolean(errors.tradeName)}
          />
          {errors.tradeName ? <p className={styles.error}>{errors.tradeName}</p> : null}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${formId}-document-type`}>Tipo de documento</label>
          <select
            id={`${formId}-document-type`}
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value as SellerDocumentType)}
          >
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor={`${formId}-document-number`}>
            {documentType === "CPF" ? "CPF" : "CNPJ"}
          </label>
          <input
            id={`${formId}-document-number`}
            required
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
            aria-invalid={Boolean(errors.documentNumber)}
            placeholder={documentType === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
          />
          {errors.documentNumber ? (
            <p className={styles.error}>{errors.documentNumber}</p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${formId}-store-email`}>E-mail de contato da loja</label>
          <input
            id={`${formId}-store-email`}
            type="email"
            required
            value={storeEmail}
            onChange={(event) => setStoreEmail(event.target.value)}
            aria-invalid={Boolean(errors.storeEmail)}
          />
          {errors.storeEmail ? <p className={styles.error}>{errors.storeEmail}</p> : null}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${formId}-phone`}>Telefone</label>
          <input
            id={`${formId}-phone`}
            type="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-invalid={Boolean(errors.phone)}
          />
          {errors.phone ? <p className={styles.error}>{errors.phone}</p> : null}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${formId}-description`}>Sobre a loja (opcional)</label>
          <textarea
            id={`${formId}-description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
          />
        </div>

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
          {isSubmitting ? "Enviando cadastro…" : "Cadastrar loja"}
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
