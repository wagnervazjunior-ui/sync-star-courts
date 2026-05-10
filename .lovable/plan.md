## Objetivo

- Master controla, por admin, se ele **pode criar campeonatos**.
- Master controla, por campeonato, **quais admins têm acesso** (já existe na aba Permissões de cada campeonato).
- Admin enxerga e edita **somente** os campeonatos que ele criou ou que o master autorizou.

A regra de visibilidade já está correta no banco: `can_view_championship(_user_id, _championship_id)` retorna true para master, criador e quem está em `championship_admins`. Então a aba "Campeonatos" já lista somente o que o admin pode ver. Falta apenas a permissão de **criar**.

## Mudanças

### 1. Banco (migration)

- Nova tabela `admin_permissions`:
  - `user_id uuid pk`
  - `can_create_championships boolean not null default false`
  - `updated_at timestamptz default now()`, `updated_by uuid`
- RLS: master pode tudo; admin pode ler a própria linha.
- Função `public.can_create_championship(_user_id uuid) returns boolean`:
  - true se master, ou se existir linha em `admin_permissions` com flag true.
- Atualizar policy `championships_admin_insert` para exigir `can_create_championship(auth.uid())` em vez de só `has_role(_, 'admin')`.
- Novas RPCs (master-only):
  - `set_admin_can_create(_user_id uuid, _value boolean)` — upsert na tabela.
- Atualizar `list_admins()` para devolver também `can_create boolean` (LEFT JOIN em `admin_permissions`; master sempre true).

### 2. Frontend

- `src/hooks/useAuth.ts`: além de `isAdmin/isMaster`, carregar `canCreateChampionships` (true se master, ou se houver flag). Expor no retorno.
- `src/routes/admin.administradores.tsx`:
  - Na lista de admins, ao lado do badge "Admin", adicionar um Switch "Pode criar campeonatos" (desabilitado para a linha do master, sempre on).
  - Ao alternar, chamar `set_admin_can_create` e recarregar.
- `src/routes/admin.campeonatos.index.tsx`:
  - Esconder/desabilitar o botão "Novo campeonato" quando `!canCreateChampionships`.
  - Mostrar texto curto explicando que precisa de permissão do master.
- `src/routes/admin.campeonatos.$id.tsx` (rota nova `/admin/campeonatos/novo` ou modal já existente):
  - Mesma proteção no submit (defesa em profundidade — o RLS já bloqueia, mas evitamos UI confusa).

### 3. Comportamento resultante

- Admin sem permissão: vê só os campeonatos onde foi adicionado (ou que criou antes), sem botão de criar.
- Admin com permissão: cria campeonatos; passa automaticamente a ser `created_by` e enxerga os próprios + os concedidos pelo master.
- Master: vê tudo, gerencia tudo.

## Arquivos

- nova migration em `supabase/migrations/`
- `src/hooks/useAuth.ts`
- `src/routes/admin.administradores.tsx`
- `src/routes/admin.campeonatos.index.tsx`
- `src/routes/admin.campeonatos.$id.tsx` (apenas guard no submit, se aplicável)

## Validação

- Logar como admin sem flag → aba Campeonatos sem botão "Novo"; tentativa via API bloqueada por RLS.
- Master ativa o switch → admin recarrega e passa a ver o botão.
- Admin cria campeonato → aparece na lista dele; outro admin (sem permissão de visualização) não vê.
- Master adiciona o segundo admin via aba Permissões → ele passa a ver/editar.
