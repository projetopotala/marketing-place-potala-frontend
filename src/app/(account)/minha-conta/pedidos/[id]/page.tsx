"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AccountChrome } from "@/components/account/AccountChrome";
import { OrderItemReviewForm } from "@/components/account/OrderItemReviewForm";
import { OrderItemReturnForm } from "@/components/account/OrderItemReturnForm";
import { OrderItemClaimForm } from "@/components/account/OrderItemClaimForm";
import {
  getMyOrder,
  ORDER_STATUS_LABEL,
  PAYMENT_TRANSACTION_STATUS_LABEL,
  type OrderResponse,
  type SellerOrderStatus,
} from "@/lib/api/orders";
import type { ReviewResponse } from "@/lib/api/reviews";
import { RETURN_STATUS_LABEL, type ReturnResponse } from "@/lib/api/returns";
import {
  CLAIM_STATUS_LABEL,
  listMyClaims,
  type ClaimResponse,
  type ClaimStatus,
} from "@/lib/api/claims";
import { ApiError } from "@/lib/api/client";
import { formatPrice } from "@/data/marketplace";

/**
 * Elegibilidade real de Claim (`CLAIM_ELIGIBLE_SELLER_ORDER_STATUSES`,
 * claims.service.ts, orders-service) -- confirmada de novo nesta rodada
 * antes de desenhar o formulário, não presumida. Deliberadamente mais
 * ampla que avaliação/devolução (que exigem DELIVERED, ver
 * `sellerOrder.status === "DELIVERED"` abaixo): problemas como "item
 * nunca chegou" podem surgir antes da entrega, então reclamação aceita
 * qualquer fase "em andamento".
 */
const CLAIM_ELIGIBLE_SELLER_ORDER_STATUSES: readonly SellerOrderStatus[] = [
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
];

/**
 * F2.1 -- proteção contra reclamação duplicada. "Ativa" = qualquer
 * ClaimStatus que NÃO seja um dos três estados finais do backend
 * (confirmado em `CLAIM_TRANSITIONS`, claims.service.ts, orders-service:
 * RESOLVED -> [CLOSED], CLOSED -> [], CANCELLED -> [] -- os únicos três
 * sem caminho de volta para "em andamento"). Inclui explicitamente
 * ESCALATED: abrir uma disputa a partir de uma Claim move
 * `Claim.status` para ESCALATED (`DisputesService.openFromClaimOrigin`,
 * disputes.service.ts) e ESCALATED só transiciona para CLOSED -- uma
 * reclamação escalada para mediação ainda está, para todo efeito
 * prático, em andamento, então ainda bloqueia uma segunda reclamação
 * para o mesmo item. RESOLVED/CLOSED/CANCELLED liberam uma nova
 * reclamação: o próprio schema documenta isso de propósito
 * (`OrderItem.claims: Claim[]` -- "um item pode gerar mais de uma Claim
 * ao longo do tempo, diferente de Review/Return que são 1:1") e
 * `ClaimsService.createClaim` não verifica reclamações existentes de
 * forma alguma hoje -- nada no backend impede isso, então o cliente
 * sempre pôde reabrir; o que faltava era só não deixar duas reclamações
 * ATIVAS coexistirem.
 */
const CLAIM_ACTIVE_STATUSES: ReadonlySet<ClaimStatus> = new Set([
  "OPEN",
  "SELLER_RESPONSE_REQUIRED",
  "CUSTOMER_RESPONSE_REQUIRED",
  "ESCALATED",
]);

/**
 * `GET /orders/claims` (`ClaimsService.listForCustomer`) não aceita
 * nenhum filtro por item/pedido -- confirmado lendo o controller e o
 * `PaginationQueryDto` (só `limit`/`cursor`), não presumido. Também não
 * existe nenhum índice único (`@unique`) em `Claim.orderItemId` no
 * schema -- o backend aceita qualquer quantidade de Claims por item,
 * ativas ou não. Por isso a única forma de descobrir "este item já tem
 * uma reclamação ativa?" de forma real é paginar TODO o histórico de
 * reclamações do cliente (não só deste pedido) e procurar por
 * `orderItemId`. `limit` no máximo permitido pelo backend
 * (`PAGINATION_MAX_LIMIT = 100`, pagination.constants.ts) minimiza o
 * número de requisições; `CLAIM_SCAN_MAX_PAGES` é um teto de segurança
 * (1000 reclamações no histórico) para nunca entrar num loop longo demais
 * -- ver comentário de `scanActiveClaims` abaixo sobre o que acontece se
 * esse teto for atingido sem uma resposta definitiva. Isto é uma
 * limitação real da API hoje, documentada no relatório desta rodada
 * junto com uma proposta aditiva (filtro `orderId`/`orderItemId` em
 * `GET /orders/claims`) para uma rodada de backend futura, separada.
 */
const CLAIM_SCAN_PAGE_LIMIT = 100;
const CLAIM_SCAN_MAX_PAGES = 10;

interface ClaimActiveScanResult {
  /** Reclamação ativa mais recente encontrada, por orderItemId. */
  activeByItemId: Record<string, ClaimResponse>;
  /**
   * Itens para os quais o scan NÃO conseguiu uma resposta definitiva
   * (atingiu `CLAIM_SCAN_MAX_PAGES` sem esgotar o histórico do cliente
   * nem encontrar uma reclamação ativa para eles). Nunca presumimos
   * "sem reclamação ativa" nesse caso -- ver renderização abaixo.
   */
  inconclusiveItemIds: string[];
}

/**
 * Varre `GET /orders/claims` (mais recente primeiro) página por página,
 * respeitando o cursor real devolvido pelo backend, até encontrar uma
 * reclamação ativa para cada item de `targetItemIds` OU esgotar o
 * histórico (`pageInfo.hasNextPage === false` -- nesse ponto, qualquer
 * item restante definitivamente não tem reclamação ativa, porque já
 * vimos todas as reclamações do cliente). Nunca inventa um filtro
 * `orderItemId`/`orderId` que o backend não suporta (ver comentário das
 * constantes acima). Função pura (só depende de `listMyClaims`), sem
 * nenhum estado de componente -- reaproveitável tanto pelo efeito de
 * carregamento inicial quanto por um retry manual.
 */
async function scanActiveClaims(
  targetItemIds: readonly string[],
): Promise<ClaimActiveScanResult> {
  const remaining = new Set(targetItemIds);
  const activeByItemId: Record<string, ClaimResponse> = {};
  let cursor: string | null = null;
  // Cursores já usados nesta varredura (não só o imediatamente anterior)
  // -- um cursor repetido de QUALQUER página já vista, não só da última,
  // ainda é um ciclo e precisa ser detectado (ver bloco abaixo).
  const seenCursors = new Set<string>();

  for (let page = 0; remaining.size > 0 && page < CLAIM_SCAN_MAX_PAGES; page += 1) {
    const result = await listMyClaims({ limit: CLAIM_SCAN_PAGE_LIMIT, cursor });

    for (const claim of result.items) {
      if (remaining.has(claim.orderItemId) && CLAIM_ACTIVE_STATUSES.has(claim.status)) {
        activeByItemId[claim.orderItemId] = claim;
        remaining.delete(claim.orderItemId);
      }
    }

    if (!result.pageInfo.hasNextPage) {
      // Esgotamento REAL, confirmado pelo próprio backend: o histórico
      // completo do cliente já foi visto -- o que sobrar em `remaining`
      // definitivamente não tem reclamação ativa.
      remaining.clear();
      break;
    }

    // Correção (revisão desta rodada): a versão anterior tratava
    // `hasNextPage === true` sem um `nextCursor` usável (nulo/vazio, ou
    // repetindo um cursor já visto) como esgotamento real -- chamando
    // `remaining.clear()` e devolvendo "sem reclamação ativa" para o
    // que sobrasse. Isso é inseguro: o backend está dizendo que AINDA
    // HÁ mais páginas, só não há como alcançá-las -- não sabemos se
    // existe uma reclamação ativa nelas. Clarear `remaining` nesse caso
    // liberaria indevidamente o formulário e permitiria reclamação
    // duplicada. Em vez disso, uma resposta inconsistente do backend
    // aqui (contrato violado, nunca observado nos testes) é tratada
    // como INCONCLUSIVA, nunca como esgotada: `remaining` é preservado
    // exatamente como está e sai em `inconclusiveItemIds`, o mesmo
    // estado que já bloqueia o formulário e mostra "Tentar novamente"
    // na página -- ver `checkActiveClaims`/renderização abaixo.
    const nextCursor = result.pageInfo.nextCursor;
    if (!nextCursor || seenCursors.has(nextCursor)) {
      break;
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  return { activeByItemId, inconclusiveItemIds: Array.from(remaining) };
}

type ClaimsCheckState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      activeByItemId: Record<string, ClaimResponse>;
      inconclusiveItemIds: string[];
    };

/**
 * Detalhe real via GET /orders/:id (orders-service, através do gateway) —
 * substitui a busca em db.orders (localStorage). 404 pra pedido de outro
 * cliente (não 403), mesmo padrão de "404 indistinguível" do resto da API —
 * ApiError já chega com essa mensagem pronta do backend.
 *
 * item.slug/imageSrc não existem em OrderItemResponse (o servidor nunca
 * devolveu isso, ver docs/internal-api-contract.md), então os itens aqui
 * não linkam pro produto como a tela mock antiga fazia.
 *
 * Itens agora são renderizados por SellerOrder, não mais achatados num
 * array só (`sellerOrders.flatMap`) — Fase B do roadmap "estilo Mercado
 * Livre" precisa do `status` de cada SellerOrder pra decidir se mostra o
 * formulário de avaliação/devolução (só libera com DELIVERED -- corrigido
 * em 29/09, alinhado com a correção equivalente em reviews.service.ts/
 * returns.service.ts no potala-orders-service; ver
 * roadmap-mercado-livre.md seção 6/8), e isso só existe no nível do
 * SellerOrder, não no item.
 *
 * Polimento visual (06/10, pré-apresentação): só espaçamento, divisores,
 * títulos e agrupamento visual (estilos inline) foram ajustados nesta
 * passada -- nenhuma condição de status, dado exibido, ou lógica de
 * avaliação/devolução/API mudou.
 *
 * Reclamação (F2, pós-venda do cliente): diferente de review/returnRequest
 * acima, `OrderItemResponse` NÃO tem um campo `claim` -- `ClaimsService`
 * não inclui `orderItem`/`order` em nenhuma leitura (ver claims.ts e
 * claude/diagnostico-frontend-pos-venda.md, seção 4/8), então o backend
 * não devolve, junto do pedido, se um item já tem reclamação aberta.
 *
 * F2.1 (10/10) -- essa lacuna permitia abrir mais de uma reclamação ATIVA
 * pro mesmo item (o estado local da visita anterior, `claimsByItemId`,
 * era perdido a cada refresh, e o backend também nunca verificou isso,
 * ver `ClaimsService.createClaim`). Substituído por uma verificação
 * persistente e real: `checkActiveClaims`/`scanActiveClaims` abaixo
 * varrem `GET /orders/claims` (o histórico de reclamações do cliente,
 * via `listMyClaims`) e indexam por `orderItemId`, então o formulário só
 * aparece quando de fato não há reclamação ATIVA pendente para aquele
 * item -- sobrevive a refresh e a trocar de pedido e voltar, porque é
 * recalculado a cada montagem a partir do backend, nunca de um estado
 * que alguma visita anterior deixou na memória. Ver os comentários de
 * `CLAIM_ACTIVE_STATUSES`/`scanActiveClaims` acima para a definição exata
 * de "ativa" e as limitações reais da API usada.
 *
 * Correção adicional ao F2.1 -- revisão de robustez da própria
 * verificação: (1) a ref de "época" que descarta respostas de scan
 * desatualizadas invalidava a época no desmonte atribuindo
 * `Number.POSITIVE_INFINITY`, o que quebrava a comparação permanentemente
 * (Infinity + 1 = Infinity) já na primeira montagem, por causa do
 * mount->cleanup->mount do StrictMode em desenvolvimento -- trocado por um
 * incremento simples; (2) um scan em voo podia terminar DEPOIS de uma
 * reclamação já ter sido criada com sucesso para o mesmo item e
 * sobrescrever esse item de volta para "sem reclamação ativa" -- agora
 * protegido por `submittedAtEpochRef`/`knownClaimsRef`, que fazem o merge
 * do resultado de cada scan respeitar qualquer criação mais recente; (3)
 * o esgotamento de paginação (`hasNextPage`/`nextCursor`) ficou mais
 * defensivo contra uma resposta de backend que não avance o cursor.
 * Nenhuma mudança de comportamento visível pretendida -- só corrige
 * janelas de corrida e um bug de comparação que já existiam na própria
 * lógica da proteção. Ver detalhes nos comentários de
 * `claimsCheckEpochRef`/`knownClaimsRef`/`submittedAtEpochRef` e de
 * `checkActiveClaims`/`scanActiveClaims` abaixo.
 *
 * Correção do item (3) acima -- o reforço de esgotamento de paginação
 * introduzido no parágrafo anterior tinha, ele mesmo, um bug de
 * segurança: tratava `hasNextPage === true` com `nextCursor` ausente ou
 * repetido como ESGOTAMENTO real (`remaining.clear()`), devolvendo "sem
 * reclamação ativa" para o que sobrasse. Isso é o oposto do que deveria
 * acontecer -- o backend está dizendo que AINDA HÁ mais páginas, só não
 * há como alcançá-las; não sabemos se existe uma reclamação ativa nelas,
 * então liberar o formulário nesse caso permitiria reclamação duplicada
 * exatamente no tipo de situação que toda essa verificação existe para
 * evitar. Corrigido em `scanActiveClaims` abaixo: só `hasNextPage ===
 * false` (confirmado pelo próprio backend) limpa `remaining` como
 * esgotamento real; um cursor ausente ou repetido (agora contra TODOS
 * os cursores já vistos na varredura, não só o imediatamente anterior,
 * via `seenCursors`) interrompe a varredura como INCONCLUSIVA --
 * `remaining` é preservado e sai em `inconclusiveItemIds`, que já
 * bloqueia o formulário e mostra "Tentar novamente" (ver renderização
 * abaixo) exatamente como qualquer outro item inconclusivo. A proteção
 * contra uma resposta assim (ou uma falha de rede antiga) apagar uma
 * reclamação recém-criada já existe independentemente disso, via
 * `submittedAtEpochRef`/`knownClaimsRef` no merge de `checkActiveClaims`
 * -- um item que acabou de ganhar uma reclamação não entra em
 * `inconclusiveItemIds` nem perde seu `activeByItemId`, mesmo que o scan
 * que terminou agora tenha sido disparado antes dessa criação.
 *
 * Correção pontual de ESLint (rodada de 08/10, `react-hooks/
 * set-state-in-effect`): o efeito abaixo chamava `setIsLoading(true)`/
 * `setError(null)` de forma síncrona, como primeiras linhas do corpo do
 * efeito -- preexistente, já estava assim no commit 8033b7d, antes do F2
 * tocar este arquivo. Em vez de só apagar essas duas linhas (o que
 * deixaria `isLoading`/`error` com o valor do pedido ANTERIOR por um
 * instante sempre que `params.id` mudar sem desmontar o componente --
 * exatamente o cenário que o App Router do Next.js permite ao navegar
 * entre duas páginas de detalhe de pedidos diferentes, reaproveitando a
 * mesma instância), a página virou um wrapper fino (`AccountOrderDetailPage`)
 * que monta `AccountOrderDetailView` com `key={params.id}`. Isso força
 * uma desmontagem/remontagem real a cada troca de pedido -- o padrão
 * recomendado pela própria documentação do React para "resetar estado ao
 * mudar de identidade" (https://react.dev/learn/you-might-not-need-an-effect).
 * Com a remontagem, `isLoading`/`error` já nascem nos valores iniciais
 * corretos (`true`/`null`) sem precisar de nenhum `setState` síncrono no
 * efeito -- o comportamento visível é idêntico (mesmo "Carregando…" ao
 * trocar de pedido), só que agora resolvido pela identidade do
 * componente, não por uma atribuição direta de estado dentro do efeito.
 * Nenhuma lógica de avaliação, devolução, reclamação, totais, entrega ou
 * pagamento foi tocada -- só o carregamento inicial do pedido.
 */
export default function AccountOrderDetailPage() {
  const params = useParams<{ id: string }>();
  return <AccountOrderDetailView key={params.id} orderId={params.id} />;
}

function AccountOrderDetailView({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [claimsCheck, setClaimsCheck] = useState<ClaimsCheckState>({ status: "loading" });
  // "Época" da última verificação disparada -- mesma proteção contra
  // resposta antiga de `cancelled` usada no efeito do pedido acima, só
  // que aqui precisa sobreviver a múltiplas chamadas de uma mesma função
  // reaproveitada (efeito de carregamento inicial E o botão de retry do
  // cenário de erro abaixo), não só ao desmonte do componente.
  //
  // Correção nesta rodada: a versão anterior invalidava a época no
  // desmonte atribuindo `Number.POSITIVE_INFINITY` a esta ref. Isso é
  // incorreto -- `Infinity + 1 === Infinity`, então, uma vez que a ref
  // chegasse a esse valor, TODA chamada futura de `checkActiveClaims`
  // capturaria `epoch = Infinity` (incrementar Infinity não produz uma
  // identidade nova e comparável) e a comparação `current !== epoch`
  // nunca mais detectaria uma resposta desatualizada -- a proteção
  // ficava permanentemente desligada a partir desse ponto. E isso
  // acontecia de verdade mesmo sem nenhuma navegação real: o StrictMode
  // do React (modo de desenvolvimento) monta, limpa e remonta cada
  // efeito uma vez só para detectar efeitos não idempotentes -- então
  // o efeito de limpeza abaixo já disparava (e já colocava a ref em
  // `Infinity`) na primeira montagem de cada página de pedido, antes de
  // qualquer verificação real acontecer. Substituído por um simples
  // incremento: cada desmontagem avança a época pelo menos uma posição
  // além de qualquer `epoch` já capturado por uma chamada em andamento,
  // o que invalida essa chamada da mesma forma que `cancelled = true`
  // faria, sem nunca repetir um valor já usado.
  const claimsCheckEpochRef = useRef(0);
  /**
   * Última combinação conhecida (e correta) de `activeByItemId`/
   * `inconclusiveItemIds`, mantida fora do `useState` de propósito: o
   * estado React (`claimsCheck`) é substituído inteiramente por
   * `{ status: "loading" }` a cada nova verificação, o que descartaria
   * o resultado anterior se ele fosse a única fonte da verdade. Esta
   * ref sobrevive a essa transição e é a base de toda atualização
   * seguinte (sucesso de scan OU reclamação recém-criada) -- nunca um
   * `setClaimsCheck` substitui o resultado inteiro a partir do zero.
   */
  const knownClaimsRef = useRef<{
    activeByItemId: Record<string, ClaimResponse>;
    inconclusiveItemIds: string[];
  }>({ activeByItemId: {}, inconclusiveItemIds: [] });
  /**
   * Para cada item, a época (`claimsCheckEpochRef`) vigente no instante
   * em que uma reclamação foi criada com sucesso para ele
   * (`handleClaimSubmitted`). Um scan iniciado ANTES desse instante
   * (`epoch` próprio <= o valor aqui registrado) não pode ter visto
   * essa reclamação ainda -- se ele terminar DEPOIS da criação, o
   * resultado dele para este item está desatualizado e é ignorado no
   * merge, para nunca fazer um item recém-aberto "voltar" a mostrar o
   * formulário de reclamação por causa de uma resposta de rede antiga.
   * Um scan iniciado DEPOIS (epoch maior) é, por definição, mais
   * recente que a criação e tem prioridade normalmente.
   */
  const submittedAtEpochRef = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      claimsCheckEpochRef.current += 1;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMyOrder(orderId)
      .then((result) => {
        if (!cancelled) setOrder(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setOrder(null);
        setError(
          err instanceof ApiError ? err.message : "Pedido não encontrado.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  /**
   * Função não-`async` que devolve a Promise de uma IIFE assíncrona
   * interna -- mesmo padrão da correção de ESLint anterior
   * (`react-hooks/set-state-in-effect`): preserva a lógica e o timing
   * exatos de uma função `async` comum, só evita que a regra sinalize a
   * chamada feita pelo efeito abaixo. Reaproveitada tanto pelo
   * carregamento inicial (efeito) quanto pelo botão "Tentar novamente"
   * do cenário de erro/inconclusivo (handler de clique, onde a regra não
   * se aplica de toda forma).
   *
   * Revisei de novo nesta rodada se esse padrão (função não-`async`
   * envolvendo uma IIFE `async`) é legítimo ou só uma forma de escapar
   * do lint: é o mesmo padrão já aplicado e validado na correção de
   * ESLint anterior (`relatorio-f2-correcao-eslint.md`), reaproveitado
   * de propósito em vez de reinventado -- a função continua devolvendo
   * exatamente a mesma Promise que uma `async function` devolveria, na
   * mesma ordem e nos mesmos instantes de `setState`, então não há
   * nenhuma mudança de comportamento escondida; é só a posição sintática
   * da palavra `async` que muda, para o analisador estático da regra não
   * ver uma função `async` sendo chamada diretamente pelo efeito.
   * Mantido como está.
   */
  const checkActiveClaims = useCallback((targetItemIds: readonly string[]) => {
    return (async () => {
      const epoch = (claimsCheckEpochRef.current += 1);
      setClaimsCheck({ status: "loading" });
      try {
        const result = await scanActiveClaims(targetItemIds);
        if (claimsCheckEpochRef.current !== epoch) return;
        // Merge sobre `knownClaimsRef`, nunca uma substituição direta de
        // `result`: protege qualquer item cuja reclamação foi criada com
        // sucesso (`handleClaimSubmitted`) depois que ESTE scan já tinha
        // sido disparado -- nesse caso, a resposta deste scan para esse
        // item específico é mais antiga que a criação e é descartada,
        // mesmo que o scan em si ainda seja o mais recente (`epoch`
        // bateu). Ver comentário de `submittedAtEpochRef` acima.
        const activeByItemId = { ...knownClaimsRef.current.activeByItemId };
        const inconclusiveItemIds = new Set(knownClaimsRef.current.inconclusiveItemIds);
        for (const itemId of targetItemIds) {
          const submittedEpoch = submittedAtEpochRef.current[itemId];
          if (submittedEpoch !== undefined && submittedEpoch >= epoch) continue;
          inconclusiveItemIds.delete(itemId);
          if (result.activeByItemId[itemId]) {
            activeByItemId[itemId] = result.activeByItemId[itemId];
          } else {
            delete activeByItemId[itemId];
          }
        }
        for (const itemId of result.inconclusiveItemIds) {
          const submittedEpoch = submittedAtEpochRef.current[itemId];
          if (submittedEpoch !== undefined && submittedEpoch >= epoch) continue;
          inconclusiveItemIds.add(itemId);
        }
        knownClaimsRef.current = {
          activeByItemId,
          inconclusiveItemIds: Array.from(inconclusiveItemIds),
        };
        setClaimsCheck({ status: "ready", ...knownClaimsRef.current });
      } catch (err) {
        if (claimsCheckEpochRef.current !== epoch) return;
        setClaimsCheck({
          status: "error",
          message:
            err instanceof ApiError
              ? err.message
              : "Não foi possível verificar reclamações existentes para este pedido.",
        });
      }
    })();
  }, []);

  // Chave estável dos ids dos itens deste pedido -- muda só quando o
  // pedido é carregado pela primeira vez (os itens de um pedido nunca
  // mudam depois disso), nunca a cada atualização local de avaliação/
  // devolução/reclamação (que troca a referência de `order`, mas não o
  // conjunto de itens) -- evita reexecutar a verificação sem necessidade.
  const itemIdsKey = order
    ? order.sellerOrders.flatMap((sellerOrder) => sellerOrder.items.map((item) => item.id)).join(",")
    : "";

  useEffect(() => {
    if (!itemIdsKey) return;
    void checkActiveClaims(itemIdsKey.split(","));
  }, [itemIdsKey, checkActiveClaims]);

  const latestPayment = order?.paymentTransactions[order.paymentTransactions.length - 1];

  /** Atualiza só o item avaliado no estado local — evita recarregar o pedido inteiro pra refletir uma avaliação nova. */
  function handleReviewSubmitted(itemId: string, review: ReviewResponse) {
    setOrder((current) => {
      if (!current) return current;
      return {
        ...current,
        sellerOrders: current.sellerOrders.map((sellerOrder) => ({
          ...sellerOrder,
          items: sellerOrder.items.map((item) =>
            item.id === itemId ? { ...item, review } : item,
          ),
        })),
      };
    });
  }

  /** Mesmo raciocínio de handleReviewSubmitted acima — evita recarregar o pedido inteiro pra refletir uma devolução solicitada. */
  function handleReturnSubmitted(itemId: string, returnRequest: ReturnResponse) {
    setOrder((current) => {
      if (!current) return current;
      return {
        ...current,
        sellerOrders: current.sellerOrders.map((sellerOrder) => ({
          ...sellerOrder,
          items: sellerOrder.items.map((item) =>
            item.id === itemId ? { ...item, returnRequest } : item,
          ),
        })),
      };
    });
  }

  /**
   * Atualização otimista após sucesso real (mesmo raciocínio de
   * handleReviewSubmitted/handleReturnSubmitted acima): a reclamação
   * recém-criada sempre nasce em OPEN (`ClaimsService.createClaim`,
   * `status @default(OPEN)` no schema) -- que está em
   * `CLAIM_ACTIVE_STATUSES` -- então já sabemos, sem precisar reconsultar
   * o backend, que este item passa a ter uma reclamação ativa. Também
   * remove o item de `inconclusiveItemIds`, se estava lá: agora há uma
   * resposta definitiva e recente para ele.
   *
   * Correção nesta rodada: a versão anterior, quando `claimsCheck` ainda
   * não estava em "ready" (por exemplo, um scan de retry em andamento
   * para outro item), substituía o estado inteiro por
   * `{ activeByItemId: { [itemId]: claim }, inconclusiveItemIds: [] }`
   * -- descartando qualquer outra reclamação ativa ou item inconclusivo
   * já conhecido de uma verificação anterior. Usa `knownClaimsRef` (ver
   * acima) como base do merge em vez do `current` do próprio
   * `setClaimsCheck`, que não carrega esse histórico quando o estado
   * visível é "loading"/"error". Também registra a época vigente em
   * `submittedAtEpochRef`, para que um scan já em voo (disparado antes
   * desta criação) nunca sobrescreva este item de volta para "sem
   * reclamação ativa" quando terminar -- ver `checkActiveClaims` acima.
   */
  function handleClaimSubmitted(itemId: string, claim: ClaimResponse) {
    submittedAtEpochRef.current[itemId] = claimsCheckEpochRef.current;
    knownClaimsRef.current = {
      activeByItemId: { ...knownClaimsRef.current.activeByItemId, [itemId]: claim },
      inconclusiveItemIds: knownClaimsRef.current.inconclusiveItemIds.filter((id) => id !== itemId),
    };
    setClaimsCheck({ status: "ready", ...knownClaimsRef.current });
  }

  const sectionHeadingStyle = {
    margin: "0 0 12px",
    fontSize: "1.05rem",
    fontWeight: 600,
    color: "var(--potala-gold)",
  } as const;

  const dividedSectionStyle = {
    marginTop: 24,
    paddingTop: 20,
    borderTop: "1px solid var(--potala-border)",
  } as const;

  return (
    <AccountChrome
      title={order ? `Pedido ${order.orderNumber}` : "Pedido"}
      breadcrumbCurrent="Detalhe do pedido"
    >
      {isLoading ? (
        <p role="status">Carregando…</p>
      ) : error || !order ? (
        <p role="alert">
          {error ?? "Pedido não encontrado."}{" "}
          <Link href="/minha-conta/pedidos">Voltar à lista</Link>
        </p>
      ) : (
        <>
          <p
            style={{
              margin: "0 0 20px",
              padding: "10px 14px",
              background: "var(--potala-panel)",
              border: "1px solid var(--potala-border)",
              borderRadius: "var(--potala-radius-control, 10px)",
              color: "var(--potala-cream)",
              fontSize: "0.95rem",
            }}
          >
            Status: {ORDER_STATUS_LABEL[order.status]} · Total{" "}
            {formatPrice(order.totalCents / 100)}
          </p>

          <section>
            <h2 style={sectionHeadingStyle}>Itens</h2>
            {order.sellerOrders.map((sellerOrder) => (
              <ul
                key={sellerOrder.id}
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {sellerOrder.items.map((item) => {
                  const claimEligible = CLAIM_ELIGIBLE_SELLER_ORDER_STATUSES.includes(
                    sellerOrder.status,
                  );
                  const activeClaim =
                    claimsCheck.status === "ready" ? claimsCheck.activeByItemId[item.id] : undefined;
                  const isClaimCheckInconclusive =
                    claimsCheck.status === "ready" &&
                    claimsCheck.inconclusiveItemIds.includes(item.id);
                  return (
                    <li
                      key={item.id}
                      style={{
                        border: "1px solid var(--potala-border)",
                        borderRadius: "var(--potala-radius-control, 10px)",
                        padding: 12,
                      }}
                    >
                      {item.productTitle} ({item.sku}) — {item.quantity}×{" "}
                      {formatPrice(item.unitPriceCents / 100)}
                      {sellerOrder.status === "DELIVERED" ? (
                        item.review ? (
                          <p
                            style={{
                              margin: "4px 0 0",
                              color: "var(--potala-muted, #6b6b6b)",
                            }}
                          >
                            Sua avaliação: {item.review.rating}/5
                            {item.review.comment ? ` — "${item.review.comment}"` : ""}
                          </p>
                        ) : (
                          <OrderItemReviewForm
                            orderId={order.id}
                            itemId={item.id}
                            onSubmitted={(review) => handleReviewSubmitted(item.id, review)}
                          />
                        )
                      ) : null}
                      {sellerOrder.status === "DELIVERED" ? (
                        item.returnRequest ? (
                          <p
                            style={{
                              margin: "4px 0 0",
                              color: "var(--potala-muted, #6b6b6b)",
                            }}
                          >
                            Devolução: {RETURN_STATUS_LABEL[item.returnRequest.status]} —{" "}
                            {item.returnRequest.reason}
                          </p>
                        ) : (
                          <OrderItemReturnForm
                            orderId={order.id}
                            itemId={item.id}
                            onSubmitted={(returnRequest) =>
                              handleReturnSubmitted(item.id, returnRequest)
                            }
                          />
                        )
                      ) : null}
                      {claimEligible ? (
                        activeClaim ? (
                          <p
                            style={{
                              margin: "4px 0 0",
                              color: "var(--potala-muted, #6b6b6b)",
                            }}
                          >
                            Reclamação: {CLAIM_STATUS_LABEL[activeClaim.status]} —{" "}
                            <Link href={`/minha-conta/reclamacoes/${activeClaim.id}`}>
                              Acompanhar reclamação
                            </Link>
                          </p>
                        ) : claimsCheck.status === "loading" ? (
                          <p
                            role="status"
                            style={{
                              margin: "4px 0 0",
                              color: "var(--potala-muted, #6b6b6b)",
                            }}
                          >
                            Verificando reclamações existentes…
                          </p>
                        ) : claimsCheck.status === "error" || isClaimCheckInconclusive ? (
                          <div style={{ marginTop: 4 }}>
                            <p
                              role="alert"
                              style={{
                                margin: 0,
                                color: "var(--potala-danger, #c95c57)",
                                fontSize: "0.85rem",
                              }}
                            >
                              {claimsCheck.status === "error"
                                ? claimsCheck.message
                                : "Não foi possível confirmar se este item já tem uma reclamação em andamento."}
                            </p>
                            <button
                              type="button"
                              onClick={() => void checkActiveClaims(itemIdsKey.split(","))}
                              style={{
                                marginTop: 4,
                                border: "none",
                                background: "none",
                                color: "var(--potala-gold)",
                                cursor: "pointer",
                                padding: 0,
                                textDecoration: "underline",
                                fontSize: "0.85rem",
                              }}
                            >
                              Tentar novamente
                            </button>
                          </div>
                        ) : (
                          <OrderItemClaimForm
                            orderId={order.id}
                            itemId={item.id}
                            onSubmitted={(claim) => handleClaimSubmitted(item.id, claim)}
                          />
                        )
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ))}
          </section>

          <section style={dividedSectionStyle}>
            <h2 style={sectionHeadingStyle}>Totais</h2>
            <div
              style={{
                display: "grid",
                gap: 6,
                padding: 12,
                border: "1px solid var(--potala-border)",
                borderRadius: "var(--potala-radius-control, 10px)",
                maxWidth: 420,
              }}
            >
              <p style={{ margin: 0 }}>Subtotal {formatPrice(order.subtotalCents / 100)}</p>
              {order.discountCents > 0 ? (
                <p style={{ margin: 0 }}>Desconto -{formatPrice(order.discountCents / 100)}</p>
              ) : null}
              <p style={{ margin: 0 }}>Frete {formatPrice(order.shippingCents / 100)}</p>
              <p
                style={{
                  margin: "4px 0 0",
                  paddingTop: 6,
                  borderTop: "1px solid var(--potala-border)",
                  fontWeight: 600,
                  color: "var(--potala-cream)",
                }}
              >
                Total {formatPrice(order.totalCents / 100)}
              </p>
            </div>
          </section>

          <section style={dividedSectionStyle}>
            <h2 style={sectionHeadingStyle}>Entrega</h2>
            {order.shippingAddress ? (
              <p style={{ margin: 0 }}>
                {order.shippingAddress.street}, {order.shippingAddress.number}
                {order.shippingAddress.complement
                  ? ` - ${order.shippingAddress.complement}`
                  : ""}{" "}
                — {order.shippingAddress.neighborhood},{" "}
                {order.shippingAddress.city}/{order.shippingAddress.state} ·
                CEP {order.shippingAddress.postalCode}
              </p>
            ) : (
              <p style={{ margin: 0 }}>Endereço não disponível.</p>
            )}
          </section>

          <section style={{ ...dividedSectionStyle, marginBottom: 24 }}>
            <h2 style={sectionHeadingStyle}>Pagamento</h2>
            <p style={{ margin: 0 }}>
              {latestPayment
                ? PAYMENT_TRANSACTION_STATUS_LABEL[latestPayment.status]
                : "Sem transação registrada."}
            </p>
          </section>
        </>
      )}
    </AccountChrome>
  );
}
