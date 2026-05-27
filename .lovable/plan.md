
## Por que os campeonatos não aparecem hoje

`listStaffChampionships` filtra por `championships.created_by = staff.owner_admin_id`. O campeonato que você criou (Estação Open - Londrina) está com `created_by = NULL` no banco (foi criado antes desse campo existir), então a query retorna vazio.

Em vez de fazer backfill cego, vamos seguir a sua regra: **o admin escolhe o campeonato ao gerar o link de convite**, e o staff só enxerga os campeonatos em que foi vinculado.

---

## Mudanças

### 1. Convite de staff por campeonato

- `staff_invites` ganha `championship_id` (obrigatório nos novos convites). Token vira único por (admin, campeonato).
- Tela `/admin/staffs`: trocar o "gerar link único" por uma lista dos campeonatos que o admin pode ver (`list_manageable_championships`), com um botão "Gerar link" por linha. Cada link aponta para `/staff/cadastro/{token}` e copia o domínio atual.
- `getInvite` / `registerStaff` / `staffLogin` passam a criar/atualizar um vínculo na nova tabela `staff_championships (staff_id, championship_id)` quando o staff usa um link daquele campeonato. Assim, um mesmo staff pode acumular vários campeonatos ao longo do tempo, reutilizando o CPF.

### 2. Listagem de campeonatos para o staff

`listStaffChampionships` passa a retornar somente os campeonatos presentes em `staff_championships` do staff logado. Resolve o problema do dropdown vazio sem afrouxar a segurança.

### 3. Cachê combinado (novo)

Nova tabela `staff_cachês` (nome interno `staff_fees`) com:
- `staff_id`, `championship_id` (UNIQUE juntos → um por staff/etapa)
- `amount_cents`, `description`, `receipt_path` (opcional, mesmo bucket `staff-receipts`)
- `status` (`pending` | `paid`), `paid_at`, `paid_by`
- `created_by_role` (`staff` | `admin`) e `created_by` (uuid) só para auditoria

Server functions novas em `staff.functions.ts`:
- `upsertStaffFee` (staff autenticado) — cria/edita o cachê dele para um campeonato em que está vinculado, enquanto status = pending.
- `adminUpsertStaffFee` (admin) — cria/edita o cachê de qualquer staff dele em qualquer campeonato visível.
- `listMyFees` (staff) e `adminListFees` (admin, filtrável por campeonato/status).
- `setFeeStatus` (admin) — marca pago / volta para pendente.
- Reuso do upload assinado já existente (`createReceiptUploadUrl`) para o anexo.

### 4. UI

- **Staff (`/staff/painel`)**: nova aba/seção "Cachês" ao lado de Reembolsos. Botão "Registrar cachê" abre dialog com seletor de campeonato (só os vinculados), valor, descrição e anexo. Lista mostra valor, status e link do recibo.
- **Admin (`/admin/staffs`)**: na linha de cada staff, botão "Cachês" abre dialog com a lista por campeonato, permitindo lançar/editar valor, marcar como pago e ver anexo. Filtro por campeonato no topo da página de reembolsos passa a valer também para cachês.

### 5. Detalhes técnicos

- Migration única com: nova coluna em `staff_invites`, nova tabela `staff_championships`, nova tabela `staff_fees` (com GRANTs + RLS bloqueando acesso direto, já que tudo passa por server functions com `supabaseAdmin`), índices e UNIQUE constraints.
- Backfill leve: marcar invites antigos sem `championship_id` como `active=false` (eles deixam de ser válidos; admin gera novos por campeonato).
- Sem mudança nos endpoints existentes de reembolso além de aceitar o novo escopo de campeonatos vindo de `staff_championships`.

### 6. Fora do escopo

- Não vamos backfillar `created_by` em campeonatos antigos.
- Não vamos permitir múltiplos cachês por staff/campeonato (parcelas/bônus ficam para depois, se precisar).
- Cachê não dispara cobrança automática nem integra com PIX/Asaas — é só registro contábil interno.
