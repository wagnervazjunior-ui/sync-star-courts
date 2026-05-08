# Admin Master e gestão de admins

## Objetivo

- A conta `junior@pexcelsp.com.br` torna-se **admin master** (poder máximo).
- Apenas o master, quando logado, pode **promover** outras contas a admin ou **revogar** o admin de alguém.
- Admins comuns continuam podendo gerenciar campeonatos, categorias e inscrições, mas **não** podem mexer em papéis de outros usuários.

## Mudanças no backend (banco)

1. Adicionar o valor `master` ao enum `app_role` (continuam: `admin`, `master`).
2. Inserir o registro do master:
   - `INSERT INTO user_roles (user_id, role) VALUES (<id da conta junior@pexcelsp.com.br>, 'master')`.
   - Também garantir que ele tenha `admin` (para acessar as telas administrativas normalmente).
3. Atualizar a função `has_role` (já existe) — sem mudança, pois ela é genérica.
4. Criar duas novas funções `SECURITY DEFINER`, ambas exigindo que `auth.uid()` tenha papel `master`:
   - `promote_user_to_admin(_email text)` — busca o usuário em `auth.users` pelo e-mail e insere `(user_id, 'admin')` em `user_roles` se ainda não existir.
   - `revoke_admin(_user_id uuid)` — remove o papel `admin` daquele usuário. Bloqueia remover o próprio master.
5. Criar uma view/função `list_admins()` (somente master) que devolve `id, email, created_at, role` juntando `auth.users` + `user_roles`, para popular a tela de gestão.
6. Ajustar políticas RLS de `user_roles`:
   - SELECT: admin/master podem ler tudo; usuário comum só lê o próprio.
   - INSERT/UPDATE/DELETE: somente via as RPCs acima (já com checagem de master). Política direta: apenas `master` pode escrever.

## Mudanças no frontend

1. **Hook de auth** (`useAuth`): adicionar campo `isMaster` consultando `user_roles` para `role = 'master'`.
2. **Layout admin** (`/admin`): mostrar item de menu "Administradores" apenas se `isMaster === true`.
3. **Nova página `/admin/administradores`**:
   - Lista de admins atuais (nome/e-mail, data, badge "Master" para o próprio).
   - Campo "Promover por e-mail" + botão **Promover a admin** (chama `promote_user_to_admin`).
   - Botão **Revogar** ao lado de cada admin (desabilitado para o próprio master).
   - Toasts de sucesso/erro tratando os erros da RPC (e-mail não encontrado, já é admin, sem permissão).
4. **Login**: remover/ajustar a frase "peça ao responsável para promover seu usuário no painel do banco" — agora a promoção é feita pela tela de administradores.

## Detalhes técnicos

- A RPC `promote_user_to_admin` precisa ler `auth.users` por e-mail; por isso é `SECURITY DEFINER` com `search_path = public, auth`.
- Todas as RPCs validam `IF NOT public.has_role(auth.uid(), 'master') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;`.
- `revoke_admin` impede revogar o próprio master e impede revogar a si mesmo, evitando lockout.
- Como o enum `app_role` é alterado, a migração roda `ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'master'` em uma migração separada do uso (Postgres exige commit antes de usar o novo valor — isso é tratado executando o `ALTER TYPE` e o `INSERT` em statements distintos).

## Fora do escopo

- Recuperação de senha do master.
- Convites por e-mail (a pessoa precisa primeiro criar a conta em `/login`; depois o master a promove).
