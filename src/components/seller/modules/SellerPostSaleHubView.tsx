"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CLAIM_STATUS_LABEL, listMySellerClaims, type ClaimResponse } from "@/lib/api/claims";
import {
  RETURN_STATUS_LABEL,
  listMySellerReturns,
  type ReturnListItemResponse,
} from "@/lib/api/returns";
import { ApiError } from "@/lib/api/client";
import { useSellerId } from "@/features/seller/useSellerId";
import styles from "@/components/seller/seller.module.css";

/** Só uma amostra curta pra prévia do painel -- a lista completa, paginada, mora nas telas dedicadas. */
const PREVIEW_SIZE = 5;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * F3 -- hub de pós-venda do vendedor. Deliberadamente SEM nenhum número
 * agregado/KPI ("X reclamações pendentes", "Y devoluções em aberto"):
 * nem `GET /seller/claims` nem `GET /seller/returns` expõem uma
 * contagem total (`PaginationQueryDto` só devolve `items` + `pageInfo.
 * hasNextPage`, nunca um total) -- calcular isso de verdade exigiria
 * varrer o histórico inteiro a cada visita a este painel (mesmo
 * problema de custo/risco já documentado pra verificação de reclamação
 * duplicada do cliente, ver claude/relatorio-f2.1-protecao-reclamacao-
 * duplicada.md), e uma contagem baseada só na primeira página seria um
 * número enganoso disfarçado de total. Em vez disso, esta tela mostra
 * só as ocorrências mais recentes (uma chamada real, de uma página só,
 * por seção) com um rótulo que deixa claro que não é o total, mais um
 * link pra lista completa, paginada de verdade, de cada seção.
 *
 * Disputas: não existe `GET /seller/disputes` (listagem) no backend --
 * só `GET /seller/disputes/:id` (ver SellerClaimsController.getDispute,
 * potala-orders-service). Construir uma listagem agregada aqui exigiria
 * inventar isso no frontend (varrer reclamações/devoluções à procura de
 * uma disputa vinculada, N chamadas) -- fora do escopo autorizado desta
 * rodada ("não inventar funcionalidades ou endpoints que ainda não
 * existem"). Documentado explicitamente abaixo em vez de simulado: uma
 * disputa é alcançável a partir da reclamação ou devolução de origem,
 * nas duas telas dedicadas.
 *
 * F3.1 -- revisão: cada seção agora tem seu próprio "Tentar novamente"
 * em caso de falha (antes só mostrava o texto do erro, sem nenhuma
 * ação), e `requestSeqRef` guarda cada carga contra uma resposta
 * obsoleta sobrescrever uma mais recente (mesmo raciocínio de
 * SellerClaimsView/SellerReturnsView -- aqui o cenário prático é o
 * duplo-efeito do Strict Mode em dev, já que esta tela não tem nenhum
 * parâmetro que mude depois do sellerId resolver).
 */
export function SellerPostSaleHubView() {
  const sellerId = useSellerId();

  const [claims, setClaims] = useState<ClaimResponse[] | null>(null);
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [isClaimsLoading, setIsClaimsLoading] = useState(true);
  const claimsSeqRef = useRef(0);

  const [returns, setReturns] = useState<ReturnListItemResponse[] | null>(null);
  const [returnsError, setReturnsError] = useState<string | null>(null);
  const [isReturnsLoading, setIsReturnsLoading] = useState(true);
  const returnsSeqRef = useRef(0);

  const loadClaims = useCallback(async () => {
    const seq = (claimsSeqRef.current += 1);
    setIsClaimsLoading(true);
    setClaimsError(null);
    try {
      const page = await listMySellerClaims({ limit: PREVIEW_SIZE });
      if (claimsSeqRef.current !== seq) return;
      setClaims(page.items);
    } catch (err) {
      if (claimsSeqRef.current !== seq) return;
      setClaims(null);
      setClaimsError(
        err instanceof ApiError ? err.message : "Não foi possível carregar as reclamações.",
      );
    } finally {
      if (claimsSeqRef.current === seq) setIsClaimsLoading(false);
    }
  }, []);

  const loadReturns = useCallback(async () => {
    const seq = (returnsSeqRef.current += 1);
    setIsReturnsLoading(true);
    setReturnsError(null);
    try {
      const page = await listMySellerReturns({ limit: PREVIEW_SIZE });
      if (returnsSeqRef.current !== seq) return;
      setReturns(page.items);
    } catch (err) {
      if (returnsSeqRef.current !== seq) return;
      setReturns(null);
      setReturnsError(
        err instanceof ApiError ? err.message : "Não foi possível carregar as devoluções.",
      );
    } finally {
      if (returnsSeqRef.current === seq) setIsReturnsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sellerId) return;
    // Duas seções independentes -- a falha de uma nunca bloqueia a
    // outra, cada uma com seu próprio loading/erro, e cada uma com seu
    // próprio par (cancelled + *SeqRef): nenhuma sequência global
    // compartilhada aqui -- invalidar a carga de reclamações nunca deve
    // invalidar a de devoluções, e vice-versa.
    //
    // F3.2 -- mesmo raciocínio de SellerClaimsView.tsx: cada
    // `cancelledX` impede sua microtarefa de chamar loadClaims/
    // loadReturns se este ciclo do efeito já tiver sido limpo, e a
    // limpeza incrementa cada *SeqRef na hora, invalidando de imediato
    // qualquer requisição deste ciclo já em voo.
    let claimsCancelled = false;
    let returnsCancelled = false;
    queueMicrotask(() => {
      if (claimsCancelled) return;
      void loadClaims();
    });
    queueMicrotask(() => {
      if (returnsCancelled) return;
      void loadReturns();
    });
    return () => {
      claimsCancelled = true;
      returnsCancelled = true;
      claimsSeqRef.current += 1;
      returnsSeqRef.current += 1;
    };
  }, [sellerId, loadClaims, loadReturns]);

  if (!sellerId) {
    return <p role="status">Carregando pós-venda…</p>;
  }

  return (
    <>
      <header>
        <h1 className={styles.pageTitle}>Pós-venda</h1>
        <p className={styles.pageLead}>
          Acompanhe e responda reclamações e devoluções relacionadas às
          suas vendas.
        </p>
      </header>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Reclamações mais recentes</h2>
        {isClaimsLoading ? (
          <p role="status">Carregando…</p>
        ) : claimsError ? (
          <div role="alert">
            <p style={{ color: "var(--potala-danger, #c95c57)" }}>{claimsError}</p>
            <button type="button" className={styles.ghostBtn} onClick={() => void loadClaims()}>
              Tentar novamente
            </button>
          </div>
        ) : !claims || claims.length === 0 ? (
          <p>Nenhuma reclamação recebida ainda.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {claims.map((claim) => (
              <li key={claim.id}>
                <Link href={`/loja/pos-venda/reclamacoes/${claim.id}`} className={styles.rowLink}>
                  <span className={styles.badge}>{CLAIM_STATUS_LABEL[claim.status]}</span>{" "}
                  {claim.reason} · {formatDate(claim.createdAt)}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p style={{ marginTop: 12 }}>
          <Link href="/loja/pos-venda/reclamacoes" className={styles.rowLink}>
            Ver todas as reclamações
          </Link>
        </p>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Devoluções mais recentes</h2>
        {isReturnsLoading ? (
          <p role="status">Carregando…</p>
        ) : returnsError ? (
          <div role="alert">
            <p style={{ color: "var(--potala-danger, #c95c57)" }}>{returnsError}</p>
            <button type="button" className={styles.ghostBtn} onClick={() => void loadReturns()}>
              Tentar novamente
            </button>
          </div>
        ) : !returns || returns.length === 0 ? (
          <p>Nenhuma devolução recebida ainda.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {returns.map((item) => (
              <li key={item.id}>
                <span className={styles.badge}>{RETURN_STATUS_LABEL[item.status]}</span>{" "}
                {item.orderItem.productTitle} · {formatDate(item.createdAt)}
              </li>
            ))}
          </ul>
        )}
        <p style={{ marginTop: 12 }}>
          <Link href="/loja/pos-venda/devolucoes" className={styles.rowLink}>
            Ver todas as devoluções
          </Link>
        </p>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Disputas</h2>
        <p>
          Uma disputa nasce de uma reclamação ou devolução escalada para
          mediação formal do Instituto Potala. Não há, hoje, uma listagem
          única de todas as disputas da sua loja — acompanhe cada disputa
          a partir da reclamação ou devolução que a originou, nas telas
          acima.
        </p>
      </section>
    </>
  );
}
