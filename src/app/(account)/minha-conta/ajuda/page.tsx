"use client";

import { useMemo, useState } from "react";
import { AccountChrome } from "@/components/account/AccountChrome";
import { ACCOUNT_HELP_FAQS } from "@/data/account";
import { textIncludes } from "@/lib/normalizeText";

export default function AccountHelpPage() {
  const [query, setQuery] = useState("");

  const faqs = useMemo(
    () =>
      ACCOUNT_HELP_FAQS.filter(
        (faq) =>
          textIncludes(faq.question, query) ||
          textIncludes(faq.answer, query) ||
          textIncludes(faq.category, query),
      ),
    [query],
  );

  const categories = [...new Set(ACCOUNT_HELP_FAQS.map((faq) => faq.category))];

  return (
    <AccountChrome
      title="Central de ajuda"
      lead="Encontre respostas para as principais dúvidas sobre sua conta e seus pedidos."
      breadcrumbCurrent="Ajuda"
    >
      <div>
        <label htmlFor="help-search">Buscar nas perguntas</label>
        <input
          id="help-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ width: "100%", minHeight: 44, marginBottom: 16 }}
        />
      </div>

      <p>Categorias: {categories.join(" · ")}</p>

      <div style={{ display: "grid", gap: 8 }}>
        {faqs.map((faq) => (
          <details
            key={faq.id}
            style={{
              border: "1px solid var(--potala-border)",
              borderRadius: 10,
              padding: "8px 12px",
            }}
          >
            <summary style={{ minHeight: 44, cursor: "pointer" }}>
              {faq.category}: {faq.question}
            </summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </div>
    </AccountChrome>
  );
}
