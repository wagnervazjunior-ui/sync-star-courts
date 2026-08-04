# Redesenho da área de Staff (admin + painel do staff)

## Contexto

A área de staff (cachês e reembolsos) está espalhada em três lugares com comportamentos inconsistentes:

- `src/routes/admin.staffs.tsx` — lista global: staffs, categorias, links de cadastro, e duas tabelas grandes (Cachês, Reembolsos) com botão "💸 PIX" que dispara `payFeeViaAsaas`/`payReimbursementViaAsaas` (transferência real via Asaas, só admin master).
- `src/routes/admin.staffs.$staffId.tsx` — detalhe de um staff: as mesmas duas tabelas, mas o botão "Marcar pago" só troca o campo `status` (`setReimbursementStatus`/`setFeeStatus`) — **não manda dinheiro nenhum**. Não tem os botões de PIX real nem de baixar comprovante Asaas.
- `src/routes/staff.painel.tsx` — painel do próprio staff: só permite **criar** reembolso e cachê (`createReimbursement`, `upsertMyFee`); não tem editar nem excluir.

Isso causa dois problemas reais:
1. Cachê e reembolso pendentes do mesmo staff/campeonato exigem **duas transferências PIX separadas** (uma por tabela).
2. A tela de detalhe do staff dá a falsa impressão de que "Marcar pago" já resolveu o pagamento, quando na real é só uma marcação manual — o staff pode não ter recebido nada.

Não existe hoje nenhum resumo agregado por categoria de reembolso (Alimentação, Transporte, Passagem, Gasolina, Hospedagem, Outro) — só o badge de categoria por linha.

## Objetivo

1. Staff conseguir editar e excluir os próprios reembolsos pendentes.
2. Mostrar total gasto por categoria de reembolso (por staff, e visão geral do campeonato).
3. Permitir pagar cachê + reembolso pendentes de um staff, no mesmo campeonato, numa única transferência PIX.
4. Levar a tela de detalhe do staff à paridade com a lista global (mesmos botões de PIX real / comprovante), mantendo "marcar pago manualmente" como alternativa para pagamento feito fora do sistema.

## Fora de escopo

- Editar/excluir cachê pelo staff (já existe upsert parcial via `upsertMyFee`; não mexer agora).
- Mudar o fluxo de aprovação do PIN (`AdminPinDialog`) ou a exigência de admin master para pagamentos via Asaas.
- Unificar pagamento entre campeonatos diferentes (fica só dentro do mesmo campeonato).
- Repaginar a navegação geral do admin (isso é uma frente separada, já identificada).

## A. Autoatendimento do staff — editar/excluir reembolso

**Backend** (`src/lib/staff.functions.ts`, `requireStaffAuth`, mesmo padrão de `createReimbursement`):

- `updateMyReimbursement({ id, category, description, amount_cents, expense_date, receipt_path })`
  - Verifica `staff_id = context.staff.id` e `status = 'pending'` antes de atualizar; senão `FORBIDDEN` / `REIMBURSEMENT_LOCKED_PAID`.
- `deleteMyReimbursement({ id })`
  - Mesma verificação de posse + status pendente antes de excluir.

**Frontend** (`src/routes/staff.painel.tsx`):

- Em `ReimbursementRow`, quando `status === 'pending'`: botões "Editar" (ícone lápis) e "Excluir" (ícone lixeira), ao lado do que já existe.
- "Editar" abre o mesmo `NewReimbursementDialog` hoje usado para criar, mas pré-preenchido e chamando `updateMyReimbursement` em vez de `createReimbursement`. Extrair o formulário para ser reutilizável entre os dois modos (criar/editar) em vez de duplicar o dialog.
- "Excluir" pede confirmação (`confirm(...)`, mesmo padrão já usado no resto do app) e chama `deleteMyReimbursement`.
- Quando `status === 'paid'`, os botões não aparecem (mesma regra do admin).

## B. Dados por categoria de reembolso

Sem função nova no backend — os dados já vêm nas listas existentes (`adminListReimbursements`, `listMyReimbursements`); a agregação é feita no cliente com `useMemo`, no mesmo padrão dos `Stat`/totais que já existem.

- **Detalhe do staff** (`admin.staffs.$staffId.tsx`): novo bloco "Por categoria" logo abaixo dos cards de totais atuais — uma linha por categoria (das 6 fixas de `CATEGORY_LABEL`) com total gasto por aquele staff; categorias sem lançamento não aparecem.
- **Lista geral** (`admin.staffs.tsx`): mesmo bloco, mas agregando `adminListReimbursements` inteiro (todos os staffs do filtro de campeonato atual) — visão geral de gasto por categoria.
- Cada linha mostra total e, entre parênteses, quanto disso já foi pago (ex.: "Alimentação — R$ 340,00 (R$ 200,00 pago)"), reaproveitando a mesma lógica de paid/pending já usada nos `Stat` existentes.

## C. Pagamento unificado (cachê + reembolso numa PIX só)

Escopo: por staff, dentro de **um único campeonato** por vez (não junta campeonatos diferentes).

**Backend** (`src/lib/staff.functions.ts`):

- `payStaffBalanceViaAsaas({ staff_id, championship_id })`
  - `assertMaster` (mesma trava dos pagamentos individuais hoje).
  - Busca todos os `staff_fees` e `staff_reimbursements` com `staff_id`, `championship_id`, `status = 'pending'`.
  - Se não houver nenhum pendente: erro `NOTHING_TO_PAY`.
  - Soma `amount_cents` de todos (cachês + reembolsos).
  - Uma chamada a `createPixTransfer` com o valor total (mesma função já usada pelos pagamentos individuais) e descrição tipo `"Fechamento staff: {nome} — {campeonato} ({N} cachês, {M} reembolsos)"`.
  - Marca **todos** os registros incluídos como `status: 'paid'`, `paid_at: now`, `paid_by: context.userId`, `asaas_transfer_id: transfer.id` (mesmo `transfer_id` em todas as linhas — o comprovante Asaas é o mesmo para todas).
  - Retorna `{ ok: true, transfer_id, total_cents, count }`.

**Frontend** (`admin.staffs.$staffId.tsx`):

- Quando o filtro de campeonato **não** é "Todos" (um campeonato específico selecionado): mostra um painel "Fechar conta — {nome do campeonato}" com o total pendente (cachê + reembolso somados) e botão **"Pagar tudo via PIX"**.
- Se não houver nada pendente naquele campeonato, o painel não aparece (ou aparece desabilitado com "Nada pendente").
- O botão passa pelo mesmo fluxo de confirmação já usado nos pagamentos individuais (dialog de favorecido + `AdminPinDialog`), só que a descrição mostra o valor total e menciona quantos itens serão pagos juntos.
- Os botões de PIX **por linha** continuam existindo nas tabelas (cachê e reembolso), para pagar um item isolado sem esperar o outro.
- Quando o filtro é "Todos os campeonatos", o painel de fechamento não aparece — precisa escolher um campeonato específico primeiro (é exatamente o filtro que já existe na tela hoje).

## D. Paridade entre as duas telas

Na tela de detalhe do staff (`admin.staffs.$staffId.tsx`), adicionar às tabelas de Cachês e Reembolsos os elementos que já existem na lista global e faltam aqui:

- Botão **"💸 PIX"** por linha pendente (chama `payFeeViaAsaas`/`payReimbursementViaAsaas`, com o mesmo dialog de confirmação de favorecido + PIN).
- Botão de **baixar comprovante** (`getAsaasTransferReceipt`) quando `status === 'paid' && asaas_transfer_id`.
- O botão atual "Marcar pago" / "Marcar pendente" continua existindo, mas passa a se chamar explicitamente **"Marcar pago manualmente"** (com tooltip "sem enviar PIX pelo sistema — use para pagamentos feitos por fora") para não ser confundido com o botão de PIX real.

Isso torna as duas telas consistentes: a diferença passa a ser só *quantos staffs* aparecem (todos vs. um), não quais ações estão disponíveis.

## Testes

- `updateMyReimbursement`/`deleteMyReimbursement`: bloqueiam quando `status = 'paid'` ou quando o `staff_id` do reembolso não é o do staff logado.
- `payStaffBalanceViaAsaas`: soma corretamente cachês + reembolsos pendentes; ignora os já pagos; erro claro quando não há nada pendente; falha se chamado por admin não-master.
- Conferência manual na UI: fechar conta de um staff com cachê + reembolso pendentes gera uma única transferência e os dois registros ficam com o mesmo `asaas_transfer_id`.
