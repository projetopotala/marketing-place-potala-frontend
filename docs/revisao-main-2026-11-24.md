# Revisão da main — 24/11/2026

## Resultado e escopo

Revisão atualizada após a chegada dos serviços de backend. Todo o trabalho foi feito nas branches `main` dos repositórios abaixo. A pasta `publish-sand-colors` não foi utilizada. Não houve commit, push, aplicação em produção ou alteração das migrations.

Foram preservadas as alterações locais anteriores do admin e do marketplace. Esta rodada corrigiu apenas contagem financeira, disponibilidade e confirmação de políticas financeiras, documentação de configuração/idempotência e fixtures de testes. A retirada de Cursos e o cabeçalho areia, feitos anteriormente, foram mantidos e verificados.

**Não é possível declarar o marketplace inteiro pronto para vendas reais:** o backend recebido ainda usa pagamento simulado e não implementa vários contratos esperados pelo frontend. O usuário confirmou que não existe uma versão mais recente nem provedor definido.

## Repositórios examinados

| Repositório | HEAD observado | Papel |
|---|---|---|
| marketing-place-potala-backend | 6611e70 | Monólito de origem; conferência de schema e migrations |
| marketing-place-potala-frontend | dd32bee + alterações locais | Loja, conta, vendedor e admin |
| potala-api-gateway | fa1883e | Encaminhamento e configuração das APIs |
| potala-identity-service | de9e8eb | Identidade, sessões e autorização |
| potala-sellers-service | fc37f37 | Vendedores e configurações básicas |
| potala-catalog-service | 3c9a7d6 | Catálogo e estoque |
| potala-orders-service | ca82232 | Pedidos, pós-venda e pagamento simulado |

A main local do frontend continua 1 commit à frente e 12 atrás da referência local origin/main. As alterações existentes impedem tratar este diretório como equivalente ao código publicado. Não foi feito merge automático ou troca de branch.

## Correções desta rodada

1. `FinanceView.tsx`: a quantidade de pedidos usa IDs distintos. Duas linhas de lojas do mesmo pedido continuam somando seus valores, mas contam como uma compra.
2. `FinancialPolicies.tsx`: a gravação fica desabilitada até a consulta da API funcionar. Respostas 404/501 mostram indisponibilidade explícita, sem prometer configuração de taxas.
3. `src/lib/api/orders.ts`: criação de política sem resposta de confirmação não gera mensagem de sucesso. Comentário de idempotência atualizado.
4. `.env.example`: documenta `API_UPSTREAM_URL`, o proxy `/api/v1` na mesma origem e o fallback antigo. Nenhuma variável real ou credencial foi alterada.
5. Comentário do checkout atualizado para refletir a reutilização da chave enquanto a página está montada e o payload não muda. O comportamento do checkout não foi modificado.
6. Testes do gateway: fixture atualizada com as URLs obrigatórias de catálogo e pedidos.
7. Testes do catálogo: UUIDs inválidos corrigidos e `$queryRaw`/`$executeRaw` disponibilizados no mock transacional. Nenhuma lógica de produção desses serviços foi alterada.
8. Testes de navegador ampliados para contagem financeira, API indisponível, resposta vazia na gravação, cabeçalho areia e ausência de links públicos de Cursos.

## Migrations e configuração do banco

| Repositório | Migrations executadas | Tabelas após execução |
|---|---:|---:|
| Monólito | 5 | 20 |
| Identity | 1 | 7 |
| Sellers | 1 | 3 |
| Catalog | 2 | 6 |
| Orders | 9 | 18 |
| Total | 18 | 54 |

Método: execução dos arquivos SQL em ordem, em instâncias temporárias e isoladas de PostgreSQL embutido (PGlite 0.3.16). Cada histórico foi comparado com outra instância criada pelo SQL que o Prisma 6.19.3 gerou a partir do schema correspondente. Colunas, defaults, nulabilidade, enums, índices, PKs e FKs coincidiram nos cinco repositórios.

Os CHECKs escritos à mão foram executados junto às migrations, mas são extras que o schema Prisma não representa; não foram excluídos do banco migrado. Sua aplicação sem erro não equivale a testar todos os valores inválidos possíveis. Os cinco schemas passaram em `prisma validate`.

Isso valida a consistência dos arquivos locais. **Não verifica o histórico aplicado em produção**, dados existentes, locks durante implantação ou concorrência real. Nenhuma conexão ao banco compartilhado foi usada. Não houve necessidade de criar ou editar migrations.

## Integrações confirmadas e limites

### Pedidos, pagamento e repasses

- Orders possui idempotência de checkout, histórico persistente de status e outbox transacional, com migrations próprias e testes aprovados.
- O gateway ativo é `MockPaymentGatewayAdapter`: aprova sem cobrar. A estrutura de webhook existe, mas o adaptador mock não recebe webhooks reais.
- Não há execução de repasse, liquidação financeira ou conexão de provedor. A tela de repasses apresenta somente previsões quando encontra snapshot; o backend recebido não fornece esse snapshot.
- A outbox persiste eventos; não há publicador nesta entrega. Não representa reconciliação automática de pagamentos/estoque.
- Aprovar uma devolução não comprova reembolso em uma instituição de pagamento.

### Contratos ausentes ou incompatíveis

| Contrato esperado pelo frontend | Situação no código recebido |
|---|---|
| GET/POST `/admin/finance/policies` | Não implementado; formulário agora bloqueia gravação quando indisponível |
| `financialSnapshot`, taxas e líquido calculado | Schema/backend não implementam o contrato esperado pela interface |
| POST `/orders/shipping-quote` | Não implementado; bloqueia a cotação exigida pelo checkout atual |
| `paymentMethod`, `deliveryChoices`, `analyticsConsent` no checkout | Rejeitados com HTTP 400 pelo ValidationPipe real; reproduzido localmente sem criar pedido |
| `/seller/settings/payments` e `/seller/settings/delivery` | Não implementados no serviço recebido |
| `/activities` e pagamento de inscrições | Não implementados nos serviços recebidos |
| `/admin/reports` e exportação do servidor | Não implementados nos serviços recebidos; CSV da tabela é outro recurso, limitado à página carregada |

Não foram removidos campos silenciosamente, criados endpoints demonstrativos ou inventadas regras de comissão, frete ou pagamento. Implementar esses contratos é uma entrega funcional adicional, não uma correção mínima de configuração.

### Financeiro e API existentes

- Resumos financeiros continuam limitados aos 100 registros consultados; não são totais globais.
- A dúvida anterior sobre paginação foi resolvida: `buildPage` no orders-service realmente usa o ID do último registro como `nextCursor`. Não foi necessário alterar a paginação.
- Cliente HTTP envia cookies e trata erros. A base local do catálogo ainda converte indisponibilidade em lista vazia/ausência; há correção na referência remota que exige reconciliar a main local antes de publicar.
- Configurações de hospedagem, cookies em produção e chaves internas não foram verificadas; só existem arquivos de exemplo nos diretórios recebidos.

## Verificação executada

| Área | Resultado |
|---|---|
| Orders | 588 testes, 26 suítes aprovados; build aprovado |
| Gateway | 66 testes, 5 suítes aprovados; build aprovado |
| Catalog | 213 testes, 11 suítes aprovados; build aprovado |
| Identity | 100 testes, 7 suítes aprovados; build aprovado |
| Sellers | 101 testes, 8 suítes aprovados; build aprovado |
| Frontend | Build/TypeScript aprovados; 16 testes Playwright aprovados em desktop e celular |
| Seletor financeiro | Regressão de pedidos divididos, snapshots ausentes, cancelados e dados vazios aprovada |
| Schemas/migrations | 5 schemas válidos; 18 migrations executadas e comparadas |

Total dos serviços: **1.068 testes em 57 suítes**. Testes de serviços usam mocks conforme as suítes; os testes Playwright interceptam APIs. Não foi executado um fluxo completo com todos os serviços e um banco real juntos. Os testes do monólito legado não foram executados; sua validação foi de banco/schema.

O lint dos arquivos financeiros apontou uma ocorrência preexistente de `react-hooks/set-state-in-effect` em `FinanceView.tsx`. O mesmo erro foi reproduzido no arquivo de HEAD, antes das correções. Não foi feita refatoração de carregamento para corrigir esse item fora do escopo. Portanto, não se declara lint integral aprovado.

## Como reproduzir as verificações principais

Em cada serviço com Prisma: `npm ci`, `npm run prisma:generate`, `npm test -- --runInBand` e `npm run build`. No gateway, omitir a geração Prisma. Para validar o schema, usar `prisma validate` com URLs de teste explícitas; não executar migrate deploy no banco compartilhado durante uma revisão.

No frontend: `npm run build`, `npx playwright test tests/e2e/admin-integration.spec.ts` e `node tests/admin-overview-regression.mjs`.

A instalação do PGlite ficou em pasta temporária, sem adicionar dependência aos projetos. A comparação usou SQL gerado por `prisma migrate diff --from-empty --to-schema-datamodel ... --script` e consultas ao catálogo PostgreSQL; não alterou arquivos de migration.

## Próximas entregas para liberar operação real

1. Reconciliar a main local do frontend com as mudanças remotas, preservando as alterações existentes.
2. Alinhar os contratos de cotação, checkout e preferências de entrega/pagamento.
3. Definir provedor, regras de comissão e repasse; implementar cobrança, autenticação de webhook, estorno e reconciliação.
4. Implementar APIs financeiras e outros módulos ainda sem backend antes de anunciá-los como operacionais.
5. Conferir migrations aplicadas e executar homologação integrada com credenciais de teste. Só então qualificar os fluxos comerciais como prontos para produção.
