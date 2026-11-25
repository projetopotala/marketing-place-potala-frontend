# Revisão de rotas do admin — 25/11/2026

Escopo: main do frontend, tabela de encaminhamento do API gateway e controllers dos quatro serviços (identity, sellers, catalog, orders). Esta revisão não confirma o ambiente de produção nem equivale a leitura de toda a lógica de negócio.

## Telas das capturas

O menu da main em 0cd6501 já não contém Conteúdos / Cursos. As páginas atuais usam ConnectedSettingsView, ConnectedIntegrationsView e ConnectedPayoutsView; as capturas mostram os placeholders anteriores. Não foi possível associar o domínio à implantação: o conector Vercel retornou 404 para marketing-place-potala.vercel.app, e o contexto conectado não listou projetos vinculados. Isso não prova falha de deploy nem cache; é necessário verificar a implantação na conta proprietária.

O acesso direto a /admin/conteudos e /admin/conteudos/:id ainda existia. Ambos agora redirecionam para /admin, sem consultar /admin/contents. Nenhum registro ou endpoint do catálogo foi apagado.

## Contratos encontrados

| Área | Contrato | Situação no código atual |
| --- | --- | --- |
| Vendedores | /admin/sellers | Gateway e controller presentes |
| Produtos e categorias | /admin/products, /admin/categories | Gateway e controllers presentes |
| Pedidos, financeiro e entregas | /admin/orders | Listagem presente; não executa transferências |
| Clientes e administradores | /admin/customers, /admin/admins | Gateway e controllers presentes |
| Cupons e devoluções | /admin/coupons, /admin/returns | Gateway e controllers presentes |
| Comissões configuráveis | /admin/finance/policies | Ausente; formulário permanece bloqueado quando a API falha |
| Integrações financeiras | Provedor e configuração administrativa | Sem implementação; adaptador de pagamentos atual é simulado |
| Repasses | Lotes, execução e conciliação | Ausentes; página atual consulta pedidos e não transfere valores |
| Relatórios | /admin/reports e exportação | Ausentes; corrigida mensagem e validação da seleção antes de exportar |
| Notificações | /notifications | Ausente; falha não aparece mais como caixa vazia |
| Documentos legais | /admin/legal/policies | Ausente; editor não deve ser considerado pronto para uso |
| Documentos de parceiros | /admin/partner-documents e /admin/partner-document-types | Ausentes; revisão/upload não prontos |

Não há um prefixo alternativo existente que resolva essas APIs ausentes. Adicionar encaminhamentos ao gateway sem controllers apenas deslocaria o 404 para outro serviço. Não foram criados endpoints de sucesso fictício.

## Outras áreas com contratos pendentes

- Checkout: frontend usa cotação /orders/shipping-quote e campos adicionais; controller atual não fornece cotação e o DTO de checkout não aceita todos esses campos. Precisa implementação coordenada, não remoção silenciosa dos campos.
- Atividades e inscrições: /activities e /me/enrollments não estão nos controllers atuais.
- Preferências de pagamento/entrega da loja: /seller/settings existe, mas não seus contratos específicos de pagamentos/entrega.
- Atributos estendidos de produto, documentos públicos/aceites e recuperação/verificação de acesso também precisam contratos próprios.

## Limites da entrega

Correções desta revisão são de navegação e tratamento de falhas reais. Não implementam os módulos de backend ausentes. CSS e as alterações visuais já existentes no diretório foram preservados. Validação de interface usa respostas interceptadas nos testes; não comprova pagamento, banco ou produção.
