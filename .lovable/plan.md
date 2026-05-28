# Reaproveitar staff entre torneios + trocar admin master

## Parte 1 — Vincular staff existente a outros torneios

### Objetivo
Hoje cada staff entra em um campeonato apenas pelo link de convite específico daquele campeonato. Vamos permitir que o admin (dono do staff) vincule manualmente um staff já cadastrado a qualquer outro torneio que ele gerencia — sem novo convite nem novo cadastro.

### Experiência do usuário
- Em `/admin/staffs`, quando há um campeonato selecionado no filtro, a lista passa a ter duas seções: **Staffs deste torneio** e **Disponíveis para vincular** (staffs do admin que ainda não estão nesse torneio), com botão **Vincular a este torneio**.
- No card de cada staff, novo botão **Vincular a outro torneio** abre um diálogo listando os torneios gerenciáveis pelo admin onde o staff ainda não está.
- Ação **Desvincular deste torneio** com confirmação (não apaga o cadastro nem o histórico em outros torneios).

### Mudanças técnicas
**Backend (`src/lib/staff.functions.ts`)**
- `listAdminStaffs`: aceitar `not_in_championship_id` para listar staffs do admin ainda não vinculados a um torneio.
- Nova serverFn `linkStaffToChampionship({ staff_id, championship_id })`: valida `assertAdminCanManageChampionship`, valida `staffs.owner_admin_id = userId`, insere em `staff_championships` com `on conflict do nothing`.
- Nova serverFn `unlinkStaffFromChampionship({ staff_id, championship_id })`: mesmas validações; bloqueia desvincular se houver `staff_fees`/`staff_reimbursements` ativos naquele torneio.

**Frontend (`src/routes/admin.staffs.tsx`)**
- Renderizar as duas seções quando filtro de campeonato estiver ativo.
- Novo `LinkStaffDialog` no card do staff.
- Item "Desvincular deste torneio" no menu, com confirmação.
- Invalidar `admin-staffs`, `admin-fees`, `admin-reimbursements` após cada ação.

**Banco**
- Sem nova tabela; garantir `UNIQUE (staff_id, championship_id)` em `staff_championships` se ainda não existir (migração curta).

## Parte 2 — Trocar o admin master para `estacao.open23@gmail.com`

### Comportamento desejado
O papel `master` deve passar a pertencer apenas ao usuário com e-mail `estacao.open23@gmail.com`. O master atual perde o papel `master` (e volta a ser admin comum, se já era admin).

### Pré-requisito
O e-mail `estacao.open23@gmail.com` precisa **já ter feito cadastro/login** no sistema pelo menos uma vez (para existir em `auth.users`). Se ainda não existir, peço para criar a conta antes de rodar a troca.

### Execução
Migração curta que, em uma transação:
1. Localiza `new_id = auth.users.id` onde `lower(email) = 'estacao.open23@gmail.com'`. Se não achar, aborta com mensagem clara.
2. `INSERT INTO public.user_roles (user_id, role) VALUES (new_id, 'master') ON CONFLICT DO NOTHING`.
3. `DELETE FROM public.user_roles WHERE role = 'master' AND user_id <> new_id`.
4. Garante `admin_permissions.can_create_championships = true` para o novo master.

### Confirmações que preciso antes de implementar
1. O e-mail `estacao.open23@gmail.com` já se cadastrou no sistema? (sim/não)
2. Posso **remover** o papel master do usuário master atual (ele continua existindo como conta, só perde o privilégio), ou prefere manter os dois como master?
