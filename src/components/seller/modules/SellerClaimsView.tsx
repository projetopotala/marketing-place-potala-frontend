"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CLAIM_STATUS_LABEL,
  listMySellerClaims,
  type ClaimResponse,
} from "@/lib/api/claims";
import { ApiError } from "@/lib/api/client";
import { useSellerId } from "@/features/seller/useSellerId";
import styles from "@/components/seller/seller.module.css";

const PAGE_SIZE = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * F3 -- pós-venda do vendedor (reclamações recebidas). Real via GET
 * /seller/claims (orders-service, através do gateway, já exposto pelo
 * gateway em `/api/v1/seller/claims` -- confirmado em proxy-routes.ts
 * antes de escrever esta tela) -- mesmo padrão de paginação por cursor
 * de SellerOrdersView/SellerReviewsView (pilha de cursors já vistos,
 * sem busca nem filtro client-side -- `PaginationQueryDto` só aceita
 * limit/cursor, confirmado em claims.service.ts).
 *
 * `ClaimsService.listForSeller` é um `findMany` cru, igual ao
 * equivalente do cliente (claims.ts, listMyClaims) -- não traz
 * produto/número do pedido (só `sellerOrderId`, o id puro). Mostrar
 * "produto"/"número do pedido" aqui exigiria uma chamada extra por linha
 * (N chamadas por página), fora do que a listagem real suporta sem
 * N+1 -- mesma decisão de design já tomada em
 * minha-conta/reclamacoes/page.tsx (lado do cliente). O link "Pedido"
 * abaixo usa `sellerOrderId` direto (campo que a listagem real tem),
 * apontando pra `/loja/pedidos/[id]` (já existente, mesmo id) -- sem
 * precisar do número formatado do pedido pra ser útil.
 *
 * F3.1 -- revisão: `goNext` usava `claims[claims.length - 1]?.id` como
 * cursor, reconstruindo às cegas o que a própria API já devolve em
 * `pageInfo.nextCursor` (confirmado em pagination.ts, orders-service:
 * `nextCursor` É literalmente `lastItem.id` da página atual, então as
 * duas formas coincidem em condições normais -- mas só uma delas é o
 * valor que o backend realmente garante como cursor válido). Agora
 * `nextCursor` vem do próprio `pageInfo` e é isso que `goNext` usa.
 *
 * Também corrigido: condição de corrida ao trocar de página rápido (ou
 * sob o duplo-efeito do Strict Mode em dev). `requestSeqRef` numera cada
 * chamada de `loadPage`; uma resposta (sucesso OU erro) só é aplicada ao
 * estado se ainda for a mais recente em voo no momento em que resolve --
 * mesmo papel da flag `ignore` do padrão oficial do React pra fetch em
 * efeito (react.dev, "Synchronizing with Effects"), só que como contador
 * em vez de boolean, pra cobrir tanto desmontagem quanto troca de página.
 * Isso também elimina a necessidade do `eslint-disable-next-line
 * react-hooks/set-state-in-effect` que existia aqui antes: a chamada a
 * `loadPage` dentro do efeito agora é adiada pra depois do commit (via
 * `queueMicrotask`), então nenhum setState roda de forma síncrona dentro
 * do corpo do efeito -- não é um disfarce sintático, é o próprio disparo
 * do fetch que passa a acontecer depois do commit, exatamente o que a
 * regra pede.
 */
export function SellerClaimsView() {
  const sellerId = useSellerId();

  const [claims, setClaims] = useState<ClaimResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Pilha de cursors já vistos, pra permitir "anterior" com uma API que só
  // oferece nextCursor (cursor-pagination é, por natureza, só pra frente).
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const requestSeqRef = useRef(0);

  const loadPage = useCallback(async (cursor: string | null) => {
    const seq = (requestSeqRef.current += 1);
    setIsLoading(true);
    setError(null);
    try {
      const page = await listMySellerClaims({ limit: PAGE_SIZE, cursor });
      if (requestSeqRef.current !== seq) return; // resposta obsoleta -- descartada
      setClaims(page.items);
      setHasNextPage(page.pageInfo.hasNextPage);
      setNextCursor(page.pageInfo.nextCursor);
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      setClaims(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as reclamações.",
      );
    } finally {
      if (requestSeqRef.current === seq) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sellerId) return;
    // F3.2 -- a microtarefa agendada abaixo só pode disparar loadPage se
    // este MESMO ciclo do efeito ainda estiver vivo quando ela rodar:
    // `cancelled` fecha sobre esta execução específica do efeito (cada
    // chamada do efeito tem a sua própria), e a limpeza abaixo marca
    // `cancelled = true` de forma síncrona assim que o efeito é limpo
    // (desmontagem, troca de página/sellerId, ou o ciclo
    // montagem->limpeza->nova montagem do Strict Mode em dev) -- sempre
    // antes de a microtarefa ter chance de rodar. Isso evita uma
    // requisição desnecessária (nunca chega a chamar loadPage) em vez de
    // só descartar o resultado depois.
    //
    // A limpeza também incrementa `requestSeqRef` diretamente: se a
    // microtarefa já tiver disparado e a requisição já estiver em voo
    // (fetch em andamento) no momento da limpeza, isso invalida essa
    // requisição IMEDIATAMENTE -- sem esperar uma próxima chamada de
    // loadPage pra tornar o seq capturado por ela obsoleto. Mesmo
    // mecanismo de epoch já usado em pedidos/[id]/page.tsx (lado do
    // cliente, F2.1b), só que por cursor/página em vez de por item.
    let cancelled = false;
    const cursor = cursorStack[pageIndex] ?? null;
    queueMicrotask(() => {
      if (cancelled) return;
      void loadPage(cursor);
    });
    return () => {
      cancelled = true;
      requestSeqRef.current += 1;
    };
  }, [sellerId, pageIndex, cursorStack, loadPage]);

  function goNext() {
    if (!hasNextPage || !nextCursor) return;
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

  function retry() {
    void loadPage(cursorStack[pageIndex] ?? null);
  }

  if (!sellerId) {
    return <p role="status">Carregando reclamações…</p>;
  }

  return (
    <>
      <header>
        <h1 className={styles.pageTitle}>Reclamações</h1>
        <p className={styles.pageLead}>
          Reclamações abertas por clientes sobre itens vendidos pela sua
          loja.
        </p>
      </header>

      <section className={styles.panel}>
        {isLoading ? (
          <p role="status">Carregando reclamações…</p>
        ) : error ? (
          <div role="alert">
            <p style={{ color: "var(--potala-danger, #c95c57)" }}>{error}</p>
            <button type="button" className={styles.ghostBtn} onClick={retry}>
              Tentar novamente
            </button>
          </div>
        ) : !claims || claims.length === 0 ? (
          <p>Nenhuma reclamação recebida ainda.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Motivo</th>
                  <th>Pedido</th>
                  <th>Data</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.id}>
                    <td>
                      <span className={styles.badge}>
                        {CLAIM_STATUS_LABEL[claim.status]}
                      </span>
                    </td>
                    <td>{claim.reason}</td>
                    <td>
                      <Link
                        href={`/loja/pedidos/${claim.sellerOrderId}`}
                        className={styles.rowLink}
                      >
                        Ver pedido
                      </Link>
                    </td>
                    <td>{formatDate(claim.createdAt)}</td>
                    <td>
                      <Link
                        href={`/loja/pos-venda/reclamacoes/${claim.id}`}
                        className={styles.rowLink}
                      >
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={pageIndex === 0 || isLoading}
            onClick={goPrevious}
          >
            Anterior
          </button>
          <span>Página {pageIndex + 1}</span>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={!hasNextPage || isLoading}
            onClick={goNext}
          >
            Próxima
          </button>
        </div>
      </section>
    </>
  );
}
