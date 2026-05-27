## Problemas identificados

**1. Reembolsos do staff não aparecem na página do admin**

A função `adminListReimbursements` em `src/lib/staff.functions.ts` (linha 504) filtra por `championship.created_by = userId`. Como muitos campeonatos têm `created_by` NULL (mesmo bug já corrigido antes na exportação Excel), nada aparece. A consulta de cachês (`adminListFees`) já não tem esse filtro.

**Correção:** remover a linha `.eq("championship.created_by", context.userId)` da query de reembolsos. O filtro por `staff.owner_admin_id` já garante o escopo correto.

## Mudanças propostas

### 1. Corrigir listagem de reembolsos (`src/lib/staff.functions.ts`)
Remover o filtro de `championship.created_by` em `adminListReimbursements` (linha 504). Mantém apenas o filtro por `staff.owner_admin_id` (idêntico ao `adminListFees`).

### 2. Nova página de detalhe do staff (`src/routes/admin.staffs.$staffId.tsx`)
Rota nova `/admin/staffs/$staffId` que exibe:
- Cabeçalho com nome do staff, CPF, contato e chave PIX (com botão copiar).
- Resumo financeiro: total/pago/pendente de reembolsos e cachês, soma geral.
- Tabela "Reembolsos" com colunas: data, campeonato, categoria, descrição, valor, status, comprovante, ação (marcar pago/pendente).
- Tabela "Cachês" com colunas: campeonato, descrição, valor, status, comprovante, ação.
- Filtros: campeonato e status (todos/pendente/pago).
- Botão "Voltar para staffs".

Novas server functions necessárias em `src/lib/staff.functions.ts`:
- `adminGetStaff({ staff_id })` — retorna dados do staff (valida `owner_admin_id`).
- `adminListReimbursementsByStaff({ staff_id, championship_id?, status? })` e `adminListFeesByStaff({ staff_id, ... })` — variantes filtradas por staff (ou reusar as existentes adicionando filtro opcional `staff_id` no schema).

Optarei por adicionar `staff_id` opcional aos schemas existentes (`ListReimbInput` e `AdminListFeesInput`), reaproveitando as duas funções.

### 3. Tornar o nome do staff clicável + busca (`src/routes/admin.staffs.tsx`)
- Envolver o nome de cada staff na tabela "Staffs cadastrados" com um `<Link to="/admin/staffs/$staffId" params={{ staffId: s.id }}>`.
- Acima da tabela, adicionar um `<Input>` de busca controlado por estado local `search`. Filtra `staffs.data.staffs` por nome (case-insensitive) e também por CPF/e-mail para conveniência.

## Arquivos alterados
- `src/lib/staff.functions.ts` — remove filtro `created_by` em `adminListReimbursements`; adiciona `staff_id` opcional nos schemas; nova fn `adminGetStaff`.
- `src/routes/admin.staffs.tsx` — input de busca + link no nome.
- `src/routes/admin.staffs.$staffId.tsx` — nova página de detalhe.

Sem migrations/schema.