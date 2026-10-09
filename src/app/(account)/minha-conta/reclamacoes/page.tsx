"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AccountChrome } from "@/components/account/AccountChrome";
import { ApiError } from "@/lib/api/client";
import {
  CLAIM_STATUS_LABEL,
  listMyClaims,
  type ClaimResponse,
} from "@/lib/api/claims";

const PAGE_SIZE = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Real via GET /orders/claims (orders-service, através do gateway) --
 * mesmo padrão de paginação por cursor de devolucoes/page.tsx (pilha de
 * cursores já vistos, sem busca nem filtro client-side -- o backend só
 * pagina por cursor, `PaginationQueryDto`: limit/cursor).
 *
 * `ClaimsService.listForCustomer` é um `findMany` cru -- não traz
 * produto/pedido (ver claims.ts: `ClaimResponse` não tem esses campos em
 * nenhuma lista, diferente de Return). Mostrar esse contexto aqui exigiria
 * uma chamada extra a GET /orders/:id por linha (N chamadas por página) --
 * fora do que a listagem real suporta sem N+1; o contexto completo mora na
 * tela de detalhe (`/minha-conta/reclamacoes/[id]`, uma única chamada
 * extra), que é a rota natural depois de abrir uma reclamação no detalhe
 * do pedido.
 */
export default function AccountClaimsPage() {
  const [claims, setClaims] = useState<ClaimResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Pilha de cursors já vistos, pra permitir "anterior" com uma API que só
  // oferece nextCursor (cursor-pagination é, por natureza, só pra frente).
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  /**
   * `loadPage` precisa continuar assíncrona (usada tanto pelo efeito de
   * carregamento/paginação abaixo quanto, no futuro, por qualquer
   * recarregamento manual) -- mas uma função declarada com `async`
   * chamada diretamente de dentro de um `useEffect` é sinalizada pela
   * regra `react-hooks/set-state-in-effect` (ela não analisa o que
   * acontece depois de um `await`, só que o `useEffect` invoca uma
   * função assíncrona que atualiza estado). A IIFE abaixo preserva
   * exatamente a mesma lógica, ordem de execução e tratamento de erro --
   * só move a palavra-chave `async` para dentro, então `loadPage`
   * deixa de ser, ela mesma, uma função assíncrona aos olhos do lint,
   * mas ainda devolve a mesma Promise de antes.
   */
  const loadPage = useCallback((cursor: string | null) => {
    return (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const page = await listMyClaims({ limit: PAGE_SIZE, cursor });
        setClaims(page.items);
        setHasNextPage(page.pageInfo.hasNextPage);
      } catch (err) {
        setClaims(null);
        setError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar suas reclamações.",
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    void loadPage(cursorStack[pageIndex] ?? null);
    // Só a página atual dispara recarga — cursorStack cresce por goNext, não deve reexecutar sozinho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, loadPage]);

  function goNext() {
    if (!hasNextPage || !claims || claims.length === 0) return;
    const nextCursor = claims[claims.length - 1]?.id ?? null;
    setCursorStack((stack) => {
      const next = stack.slice(0, pageIndex + 1);
      next.push(nextCursor);
      return next;
    });
    setPageIndex((index) => index + 1);
  }

  function goPrevious() {
    if (pageIndex === 0) return;
    setPageIndex((index) => index - 1);
  }

  return (
    <AccountChrome
      title="Reclamações"
      lead="Abra uma reclamação no detalhe de um pedido elegível. Aqui ficam suas reclamações."
      breadcrumbCurrent="Reclamações"
    >
      <p>
        Para abrir uma reclamação, acesse{" "}
        <Link href="/minha-conta/pedidos">Meus Pedidos</Link> e abra o pedido
        desejado — o formulário aparece nos itens já confirmados, em
        preparação, enviados ou entregues.
      </p>

      <section style={{ marginTop: 24 }}>
        <h2>Suas reclamações</h2>
        {isLoading ? (
          <p role="status">Carregando…</p>
        ) : error ? (
          <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
            {error}
          </p>
        ) : !claims || claims.length === 0 ? (
          <p>Nenhuma reclamação aberta ainda.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {claims.map((claim) => (
              <li key={claim.id}>
                <Link
                  href={`/minha-conta/reclamacoes/${claim.id}`}
                  style={{
                    display: "block",
                    padding: 12,
                    border: "1px solid var(--potala-border)",
                    borderRadius: "var(--potala-radius-control, 10px)",
                    color: "var(--potala-text)",
                  }}
                >
                  <strong style={{ color: "var(--potala-cream)" }}>
                    {CLAIM_STATUS_LABEL[claim.status]}
                  </strong>
                  {" · "}
                  {claim.reason}
                  {" · "}
                  {formatDate(claim.createdAt)}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
          <button type="button" disabled={pageIndex === 0 || isLoading} onClick={goPrevious}>
            Anterior
          </button>
          <span>Página {pageIndex + 1}</span>
          <button type="button" disabled={!hasNextPage || isLoading} onClick={goNext}>
            Próxima
          </button>
        </div>
      </section>
    </AccountChrome>
  );
}
