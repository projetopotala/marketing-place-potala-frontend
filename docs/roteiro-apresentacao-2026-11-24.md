# Roteiro de apresentação — Marketplace Potala

**Duração sugerida:** 7 a 10 minutos.  
**Referência:** revisão local de 24/11/2026.  
**Objetivo:** mostrar os ajustes solicitados e as evidências de teste, separando demonstração validada de operação comercial ainda pendente.

## 1. Abertura — 40 segundos

**Fala sugerida**

“Esta revisão preservou a estrutura atual do admin e do marketplace. O foco foi manter os ajustes visuais pedidos, retirar Cursos da navegação pública e conferir a base de APIs, financeiro e migrations. Fizemos correções pontuais onde havia inconsistências, sem redesenhar o sistema.”

**Mostrar:** página pública com cabeçalho e acesso ao admin. Não iniciar uma compra real durante esta apresentação.

## 2. Aparência e navegação — 1 minuto

**Fala sugerida**

“O cabeçalho permanece em areia claro, com a faixa superior em um tom suave. Os botões mantêm o destaque amarelo. Cursos foi retirado dos links do cabeçalho, rodapé, navegação de atividades e das categorias em destaque. As inscrições e os dados existentes não foram apagados.”

**Mostrar:** cabeçalho, rodapé e navegação de Eventos em desktop e celular.

**Evidência:** testes de navegador verificam a cor do cabeçalho e a ausência de links para Cursos na página de Eventos nos dois tamanhos de tela. O filtro das categorias em destaque passou em build e revisão de código; não foi validado com um catálogo real de produção.

**Estado:** ajuste visual e de navegação validado localmente. Não implica que a API de Eventos esteja disponível.

## 3. Admin preservado — 1 minuto

**Fala sugerida**

“A organização atual do admin foi mantida. A revisão confirmou a navegação das telas existentes, consultas com respostas de API de teste, detalhes de registros, busca e exportação da tabela. Também verificamos que falhas de consulta não viram vendas fictícias.”

**Mostrar:** dashboard, listagem de produtos, detalhe e financeiro em ambiente de demonstração preparado.

**Explicar:** o CSV da tabela exporta o recorte carregado. Ele não equivale ao relatório completo do servidor, cuja API está pendente nesta versão do backend.

**Evidência:** testes de desktop e celular cobrem navegação, detalhes, paginação de detalhe, busca, CSV e ação de produto com API interceptada.

**Estado:** interface testada para demonstração; integração de cada módulo em produção depende do contrato correspondente.

## 4. Correções financeiras — 1 minuto e 30 segundos

**Fala sugerida**

“Corrigimos um caso importante: quando a mesma compra é dividida entre duas lojas, seus valores continuam somados, mas a quantidade de pedidos conta essa compra uma única vez.”

“Também protegemos a configuração de políticas financeiras. Se o servidor não oferece essa API, a tela informa a indisponibilidade e impede a gravação. E, se uma tentativa de gravação retorna sem confirmar a criação, não mostramos sucesso.”

**Mostrar três cenários de teste:**

1. Duas linhas de lojas, um mesmo pedido: quantidade igual a um.
2. API de políticas ausente: mensagem clara e botão de aprovação desabilitado.
3. API responde sem confirmar criação: mensagem de erro, sem confirmação falsa.

**Explicar:** os indicadores usam até 100 registros; não representam fechamento contábil completo. Valores de repasse são previsões quando existe snapshot. O backend recebido ainda não fornece o contrato de snapshot esperado pelo frontend.

**Estado:** proteções e contagem testadas. Configuração real de comissão e execução de repasses continuam pendentes.

## 5. Base técnica conferida — 1 minuto e 30 segundos

**Fala sugerida**

“Conferimos os cinco schemas de banco e executamos as 18 migrations em bancos temporários. Depois comparamos as estruturas resultantes com os schemas: colunas, índices, chaves e enums coincidiram. Não alteramos nem aplicamos migrations no banco de produção.”

“Os cinco serviços passaram em 1.068 testes automatizados e em compilação. O frontend também compilou e passou em 16 testes de navegador em desktop e celular.”

| Área | Testes aprovados |
|---|---:|
| Pedidos | 588 |
| Gateway de APIs | 66 |
| Catálogo | 213 |
| Identidade | 100 |
| Vendedores | 101 |
| Total dos serviços | **1.068** |
| Navegador: admin e vitrine | **16** |

**Complemento para perguntas técnicas:** o serviço de pedidos já possui idempotência, histórico de status e persistência de outbox. A outbox ainda não tem publicador. Fixtures antigas de configuração e estoque foram corrigidas para que os testes representassem o contrato atual.

**Limite da evidência:** testes usam dependências simuladas; não substituem homologação de todos os serviços juntos. As migrations aplicadas em produção ainda precisam ser conferidas. Há uma ocorrência de lint preexistente no financeiro; não anunciar “lint completo aprovado”.

## 6. O que está pronto e o que ainda não está — 1 minuto e 30 segundos

**Fala sugerida**

“Temos uma base validada para demonstrar os ajustes de interface e as correções pontuais. Ainda não estamos declarando o fluxo comercial completo pronto para produção.”

| Item | Classificação correta |
|---|---|
| Cabeçalho areia e retirada dos links de Cursos | Validado localmente para apresentação |
| Contagem financeira e bloqueio de políticas indisponíveis | Corrigidos e testados |
| Navegação e detalhes do admin | Testados com APIs simuladas |
| Migrations locais | Executadas e comparadas; aplicação em produção não verificada |
| Autenticação, catálogo, estoque e pedidos | Suítes dos serviços aprovadas; homologação integrada pendente |
| Cobrança real, estorno e repasse | Não disponíveis; provedor ainda não definido |
| Checkout atual do frontend com estes backends | Bloqueado por contratos incompatíveis e cotação ausente |
| Políticas financeiras, snapshots e relatórios do servidor | APIs ainda não implementadas nos serviços recebidos |

**Explicação curta do bloqueio do checkout:**

“O frontend exige uma cotação de entrega que este backend não oferece. Também envia campos que a validação atual rejeita. Não removemos essas escolhas silenciosamente para aparentar funcionamento. É necessário alinhar os contratos antes da homologação.”

**Explicação curta dos pagamentos:**

“O adaptador atual simula aprovação e não movimenta dinheiro. Nenhum teste apresentado comprova cobrança ou transferência bancária real.”

## 7. Encerramento — 40 segundos

**Fala sugerida**

“Entregamos os ajustes pontuais e uma conferência reproduzível da base local. O próximo passo é alinhar as versões de frontend e backend, implementar os contratos ausentes e definir o provedor financeiro. Depois faremos homologação integrada antes de liberar vendas e repasses reais.”

## Preparação da demonstração

- Usar ambiente local ou de homologação com dados de teste. Preparar os cenários financeiros com fixtures; os testes de navegador já demonstram esses comportamentos.
- Mostrar a revisão e o relatório dos testes para sustentar os números. Não apresentar um dado simulado como transação de produção.
- Confirmar a versão que será exibida: a main local do frontend contém alterações não publicadas e diverge da referência remota.
- Esta rodada não incluiu commit, push, deploy, aplicação de migration em produção ou novo desenho do admin.

## Referência técnica

Ver [revisão completa da main](./revisao-main-2026-11-24.md) para arquivos alterados, limitações, contratos ausentes e comandos de validação.
