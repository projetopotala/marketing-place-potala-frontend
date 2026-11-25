# Integração da interface administrativa antiga

**Objetivo aprovado:** interface de `origin/admin-antigo` com as APIs e funcionalidades da `main`, na paleta areia/dourado atual.

**Arquitetura:** reaproveitar shell, tabelas, modais, gráficos e CSS existentes. Recuperar os blocos visuais removidos adaptando-os aos contratos atuais; nunca substituir consultas por `AdminDemoDb`. Preservar módulos novos, autenticação e operações reais.

**Alternativas:** copiar a branch restauraria dados fictícios e removeria funcionalidades; adaptar somente a apresentação preserva a integração atual e foi a opção escolhida pelo usuário.

**Restrições:** não inventar endpoints nem confirmar operações sem persistência; indicar recorte de paginação nos indicadores e filtros; manter CSS global e contratos atuais. Recursos sem suporte ficam explicitamente indisponíveis.

## Execução
- [x] Restaurar dashboard: seis indicadores, três gráficos, vendedores, pedidos, resumo, alertas, aprovações e produtos; alimentar com APIs existentes.
- [x] Recuperar busca/filtro/exportação e detalhes de consulta nas listagens usando registros reais e identificando o recorte carregado.
- [x] Restaurar navegação e apresentação de entregas, repasses, integrações e configurações sem mutações demonstrativas; preservar relatórios reais e módulos novos.
- [x] Reaplicar composição antiga ao financeiro e relatórios, preservando políticas e exportações atuais.
- [x] Verificar cálculos com pedidos divididos por vendedor, estados vazios/erros, paginação, operações reais, telas desktop/mobile, lint, TypeScript e build.

## Pontos de revisão
Pedidos divididos não podem duplicar totais; valores sem snapshot não são zero; busca de página não é busca global; falha de API não deve apresentar seed; navegação não deve expor mutações locais antigas.

## Evidências
Base local: main 9f2d5a8; referência: origin/admin-antigo d72425e. Árvore limpa antes da execução. README contém descrição demonstrativa desatualizada em relação às APIs presentes no código.

- `npm run build`: aprovado, incluindo TypeScript e geração de 69 páginas.
- `node tests/admin-overview-regression.mjs`: aprovado (pedido dividido, snapshots ausentes, cancelamento e listas vazias).
- `npx playwright test tests/e2e/admin-integration.spec.ts`: 10 aprovados em desktop 1440 e mobile 390. Respostas HTTP controladas, sem backend real nem mutações externas.
- `git diff --check`: aprovado.
- `npm run lint`: 21 erros e 5 avisos preexistentes. Comparação via ESLint dos arquivos atuais com `git show HEAD:<arquivo>` confirmou a mesma contagem de erros em cada um dos 21 arquivos; nenhum erro novo.
- Revisão independente: corrigidos import de CSS em Server Component e cores antigas nas legendas/tooltips. Inspeção visual e teste mobile identificaram e corrigiram tabelas escondidas e gráficos em colunas estreitas.

## Adaptações aos contratos atuais
A interface é adaptada, não uma cópia literal do demonstrativo. Entregas usam pedidos reais em consulta; repasses exibem previsões, sem criar lotes ou marcar pagamento. Integrações não simulam conexão. Configurações mantêm as seis seções, com políticas financeiras reais e ações indisponíveis claramente indicadas. Relatórios preservam exportações do servidor; gráficos demonstrativos sem fonte real não foram reintroduzidos. Busca superior navega entre seções; busca de registros, filtros e CSV abrangem a página carregada. Detalhes consultam páginas da API até localizar o registro, sem seed ou mutações locais. Autenticação e módulos novos da main preservados. Não foi validado contra um backend de produção. Alterações locais, sem commit/push.
