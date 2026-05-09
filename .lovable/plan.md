## Objetivo

Adicionar confirmações em ações destrutivas, regra de idade para categorias Master, planilha da portaria e controle de permissões por campeonato (master vs admin).

---

## 1. Confirmações no admin

Em `admin.categorias.$categoryId.tsx`, envolver os botões **Confirmar inscrição** e **Cancelar inscrição** num `AlertDialog` (já disponível em `components/ui/alert-dialog.tsx`).
- "Cancelar inscrição": título "Cancelar inscrição?", descrição com voucher e nome da dupla, botões "Voltar" / "Cancelar inscrição" (destructive).
- "Confirmar inscrição": título "Confirmar inscrição?", descrição idem, botões "Voltar" / "Confirmar".

---

## 2. Categoria por idade (Master)

### Banco
Migration adiciona em `categories`:
- `age_rule_mode text` check em `('none','individual_min','sum_min')` default `'none'`.
- `age_min int` — idade mínima (por atleta) ou soma mínima.

Em `registrations`:
- `athlete1_birthdate date`, `athlete2_birthdate date` (nullable; obrigatórios apenas quando a categoria tiver `age_rule_mode <> 'none'`).

`create_registration` passa a aceitar `athleteN_birthdate` no payload e, quando a categoria exige idade, valida no servidor:
- Idade calculada como **(ano do start_date do campeonato) − (ano de nascimento)** — "idade completada no ano do campeonato".
- `individual_min`: cada atleta ≥ `age_min`.
- `sum_min`: soma das idades ≥ `age_min`.
- Falha com `AGE_RULE_VIOLATION`.

### Admin (cadastro de categoria)
No formulário de categoria (em `admin.campeonatos.$id.tsx` e `admin.campeonatos.index.tsx`), adicionar:
- Select **Regra de idade**: "Sem regra" / "Idade mínima por atleta" / "Soma mínima das idades".
- Quando ≠ "Sem regra", input numérico **Idade mínima**.

### Inscrição (`inscricao.$categoryId.tsx`)
- Quando categoria tem `age_rule_mode <> 'none'`, exibir campo **Data de nascimento** dentro do bloco de cada atleta.
- Validação client-side com a mesma fórmula do servidor; mostrar mensagem clara ("A soma das idades em 2026 deve ser ≥ X").
- Tratar erro `AGE_RULE_VIOLATION` no submit.

---

## 3. Planilha da portaria

Nova função `generateGateListWorkbook` em `src/lib/uniform-export.ts` (ou novo `gate-list-export.ts`):
- Apenas inscrições `confirmed`.
- Uma aba por categoria (nome truncado em 31 chars).
- Colunas: **Nome completo do atleta** · **Nome da dupla**.
- Linhas geradas a partir de `athlete1_name` e `athlete2_name` (duas linhas por inscrição), ordenadas alfabeticamente pelo nome do atleta (A‑Z, locale pt-BR).
- Cabeçalho em negrito.

Botões de download:
- Em `admin.campeonatos.$id.tsx`: "Baixar lista da portaria" (todas as categorias do campeonato).
- Em `admin.categorias.$categoryId.tsx`: "Baixar lista da portaria desta categoria".

---

## 4. Permissões master × admin por campeonato

### Banco
- Nova coluna `championships.created_by uuid` (preenchida no insert via RPC ou trigger usando `auth.uid()`).
- Nova tabela `championship_admins (championship_id uuid, user_id uuid, granted_by uuid, created_at)`, PK `(championship_id, user_id)`, RLS habilitado.
- Função `can_view_championship(_user_id uuid, _championship_id uuid) returns boolean security definer`:
  - true se master, ou criador, ou existe linha em `championship_admins`.

### RLS
- `championships`:
  - Master: tudo (já coberto via `has_role master`).
  - Admin (não master): SELECT/UPDATE/DELETE somente quando `can_view_championship(auth.uid(), id)`. INSERT permitido para qualquer admin (vira criador).
- `categories` e `registrations`: políticas de admin passam a checar `can_view_championship` via join no `championship_id`.
- `championship_admins`: somente master gerencia (ALL); admin lê apenas as próprias linhas.

### Backend funcs
- `grant_championship_admin(_championship_id, _email)` e `revoke_championship_admin(_championship_id, _user_id)` (security definer, somente master).
- `list_championship_admins(_championship_id)` (master ou criador do campeonato).

### UI
- **Listagem de campeonatos no admin**: passa a respeitar RLS automaticamente (admin não-master só vê o que pode).
- Nova rota **`admin.campeonatos.$id.permissoes.tsx`** (visível só para master): lista admins com acesso ao campeonato, input de e-mail + "Adicionar", botão remover.
- Em `admin.administradores.tsx` (página do master), adicionar coluna/ação rápida "Gerenciar campeonatos" → leva para uma aba que mostra, por admin, os campeonatos que ele enxerga, com toggle.
- Esconder ações de edição/exclusão de campeonatos para admins sem permissão.

---

## 5. Detalhes técnicos

- Migration única cobrindo: alter `categories` (age_rule_mode, age_min), alter `registrations` (athleteN_birthdate), alter `championships` (created_by + backfill `auth.uid()` no insert via trigger), nova tabela `championship_admins`, função `can_view_championship`, RPCs `grant/revoke/list_championship_admins`, atualização de `create_registration` com validação de idade, atualização de RLS de `championships/categories/registrations`.
- Fórmula de idade no servidor e no cliente: `extract(year from championships.start_date) - extract(year from birthdate)`. Se `start_date` for nulo, usa o ano corrente.
- ExcelJS reaproveitado para a planilha da portaria.
- AlertDialogs reutilizam o componente shadcn já existente.

---

## Arquivos afetados

- `supabase/migrations/<timestamp>_age_rule_and_permissions.sql` (novo)
- `src/lib/gate-list-export.ts` (novo)
- `src/routes/admin.categorias.$categoryId.tsx` (AlertDialogs + botão portaria)
- `src/routes/admin.campeonatos.$id.tsx` (form de categoria com regra de idade + botão portaria + esconder ações sem permissão)
- `src/routes/admin.campeonatos.index.tsx` (form de categoria com regra de idade)
- `src/routes/admin.campeonatos.$id.permissoes.tsx` (novo, master only)
- `src/routes/admin.administradores.tsx` (link/ação para gerenciar permissões por campeonato)
- `src/routes/inscricao.$categoryId.tsx` (campo data de nascimento + validação + tratamento de erro)
- `src/integrations/supabase/types.ts` (auto)
