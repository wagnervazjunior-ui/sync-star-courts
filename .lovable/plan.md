## Objetivo

Reestruturar a tela do campeonato em sub-abas. Ao clicar no nome de um campeonato em **Campeonatos**, abrir `/admin/campeonatos/$id` com a aba **Configurações** já selecionada. Resolve também o "botão de Permissões não funciona" porque Permissões vira uma sub-aba interna em vez de uma rota separada.

## Sub-abas previstas

```
/admin/campeonatos/$id
  ├─ Configurações (default)  ← todos os campos do dialog "Editar campeonato"
  ├─ Dashboard                 ← métricas
  ├─ Categorias                ← criar/editar/excluir categorias (igual hoje)
  ├─ Inscrições                ← lista filtrada por este campeonato
  ├─ Planilhas                 ← Uniformes + Lista da portaria (downloads .xlsx)
  └─ Permissões (só master)    ← gerenciar admins do campeonato
```

Estado da aba ativa via search param `?tab=configuracoes|dashboard|categorias|inscricoes|planilhas|permissoes` (default `configuracoes`), para suportar deep-link e refresh.

## Arquivos

### `src/routes/admin.campeonatos.$id.tsx` (refatorado)
- Header: voltar, nome do campeonato, badge ativo/inativo, link "Ver página pública".
- `<Tabs value={tab} onValueChange={...}>` com os triggers acima (Permissões só renderiza se `isMaster`).
- Cada aba renderiza um componente local definido no mesmo arquivo (ou em `src/components/admin/championship/`):
  - **`ConfigTab`**: extrai todo o conteúdo do `ChampionshipDialog` de `admin.campeonatos.index.tsx` (uploads de capa e tabela de medidas, modelos de uniforme, datas, textos legais, switch ativo). Salva via `update` na tabela `championships`. Botão "Salvar alterações" no topo direito da aba.
  - **`DashboardTab`**: cards com totais — categorias ativas/total, inscrições por status (pendente/confirmada/cancelada), receita confirmada (soma `amount_cents` de confirmadas), % ocupação (soma confirmed/pending dividido pelo total de `max_slots`), próximas datas (limite de garantia de tamanho, início/fim).
  - **`CategoriesTab`**: o conteúdo atual da página (lista de categorias + dialog "Nova categoria").
  - **`InscricoesTab`**: reusa a tabela/filtros de `admin.inscricoes.tsx`, mas pré-filtrada por `championshipId = id` (sem o seletor de campeonato).
  - **`PlanilhasTab`**: dois cards — "Planilha de uniformes" (gera `.xlsx` com `generateUniformWorkbook`) e "Lista da portaria" (atual botão).
  - **`PermissoesTab`**: copia o conteúdo de `admin.campeonatos.$id.permissoes.tsx` (formulário de e-mail + lista de admins concedidos via `list_championship_admins` / `grant_championship_admin` / `revoke_championship_admin`).

### `src/routes/admin.campeonatos.index.tsx`
- Card de cada campeonato: o nome vira um `<Link to="/admin/campeonatos/$id">` (abre na aba Configurações). Remover o ícone do lápis (a edição agora é feita dentro da aba Configurações).
- Botão "Categorias" continua, mas agora aponta para `?tab=categorias`. Manter o botão "Excluir".
- O dialog "Novo campeonato" continua aqui (criação rápida). A edição inline some.

### `src/routes/admin.campeonatos.$id.permissoes.tsx`
- Excluir o arquivo. Permissões agora vive na sub-aba.

### `src/lib/uniform-export.ts` e `src/lib/gate-list-export.ts`
- Já existem. Apenas reutilizados pelo `PlanilhasTab`.

## Detalhes técnicos
- `useSearch` da rota para ler `tab`; navegar com `navigate({ search: (s) => ({ ...s, tab }) })` ao trocar de aba.
- `validateSearch` no `createFileRoute` para tipar `tab`.
- Permissões: bloqueada com `if (!isMaster) return null;` dentro do componente da aba; o trigger só aparece se `isMaster`.
- Reaproveitar `useQuery` para campeonato + categorias (compartilhado entre Dashboard, Inscrições, Planilhas e Categorias) usando `queryKey` por id.
- Estética: shadcn `Tabs` com `TabsList` no topo, sticky horizontal, scroll-x em mobile.

## Verificação
1. Em `/admin/campeonatos`, clicar no nome de um campeonato → abre `/admin/campeonatos/$id` com aba **Configurações** preenchida.
2. Trocar abas atualiza o `?tab=...` na URL; refresh mantém a aba.
3. Salvar em **Configurações** atualiza o campeonato e mostra toast.
4. **Permissões** aparece para master e abre o formulário/lista (substitui o botão antigo que não respondia).
5. **Planilhas** baixa os dois arquivos `.xlsx` corretamente.

## Arquivos editados
- `src/routes/admin.campeonatos.$id.tsx` (reescrito com tabs)
- `src/routes/admin.campeonatos.index.tsx` (nome vira link, remove edição inline)
- `src/routes/admin.campeonatos.$id.permissoes.tsx` (excluído — vira aba interna)
