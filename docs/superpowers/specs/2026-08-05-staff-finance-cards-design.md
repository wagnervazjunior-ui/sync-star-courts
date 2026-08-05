# Cards de cachê/reembolso por staff (substitui as tabelas planas + unifica com a aba do campeonato)

## Contexto

Hoje existem duas telas separadas mostrando os mesmos dados financeiros de staff (`staff_fees`/`staff_reimbursements`), com features diferentes:

- `src/routes/admin.staffs.index.tsx` — lista geral: duas tabelas planas ("Cachês combinados", linha ~756; "Reembolsos", linha ~873), uma linha por lançamento, com PIX real (`payFeeViaAsaas`/`payReimbursementViaAsaas`), comprovante Asaas, exclusão por item, e um bloco de resumo por categoria (linha ~849).
- `StaffTab` dentro de `src/routes/admin.campeonatos.$id.tsx` (linha ~1294) — mesma ideia, mas versão mais simples e mais antiga: sem PIX real (só "Marcar pago" que troca status), sem comprovante Asaas, sem exclusão, sem link pro staff, sem categoria.

Isso já foi identificado como o problema de "páginas dentro e fora do campeonato" que o usuário levantou. Além da duplicação, o formato de tabela plana (uma linha por lançamento, sem agrupar por staff) dificulta ver rápido "quanto eu devo pagar pra esse staff" e agir sobre isso.

## Objetivo

1. Um componente único, reaproveitado nas duas telas — acaba com a duplicação de vez.
2. Trocar as tabelas planas por um card por staff: cachê pendente, reembolso detalhado por categoria, total a pagar, e botão de pagar ali mesmo.
3. Os cards de resumo geral (totais de cachê, de reembolso, e por categoria) continuam no topo da página, como já existem hoje.
4. A tela de detalhe do staff (`admin.staffs.$staffId.tsx`, linha-a-linha, exclusão por item, comprovante por item) continua existindo — o card é um resumo com ação rápida, não substitui o detalhe.

## Fora de escopo

- Mudar a regra de `payStaffBalanceViaAsaas` (continua só dentro do mesmo campeonato, uma PIX por vez).
- A tabela "Staffs cadastrados" (nome/área/CPF/contato/PIX, linha ~534 de `admin.staffs.index.tsx`) — é gestão de cadastro/papel, não financeiro. Fica como está.
- O botão "Baixar Excel" / `exportStaffFinanceXlsx` — fica como está.
- Dar ao admin a capacidade de editar valores de reembolso (só staff edita o próprio, decisão já tomada antes).
- Mudar o PIN/gate de admin master pra pagamentos via Asaas.

## Design

### Onde entra

- **`admin.staffs.index.tsx`**: as seções "Cachês combinados" e "Reembolsos" (incluindo o bloco "Reembolsos por categoria (todos os staffs)") são substituídas por `<StaffFinanceCards />`. A seção "Filtros" (campeonato/área/status) e "Staffs cadastrados" continuam exatamente como estão.
- **`StaffTab`** (dentro de `admin.campeonatos.$id.tsx`): as duas `Card`s de Cachê e Reembolso são substituídas pelo mesmo `<StaffFinanceCards />`, com `championshipId` fixo (o campeonato da página).

### Novo componente compartilhado

Arquivo novo: `src/components/StaffFinanceCards.tsx`.

```ts
type StaffFinanceCardsProps = {
  reimbursements: any[]; // shape de adminListReimbursements: cada item tem .staff.{id,name,pix_key,pix_key_type}, .amount_cents, .status, .category
  fees: any[];           // shape de adminListFees: cada item tem .staff.{...}, .amount_cents, .status
  championshipId: string | null; // id específico = botão de pagar habilitado; null = tela geral sem filtro, sem botão
  isMaster: boolean;
  onPaid: () => void; // chamador invalida as queries de reimbs/fees após um pagamento
};
```

O chamador (`admin.staffs.index.tsx` ou `StaffTab`) continua responsável por buscar e filtrar `reimbursements`/`fees` (campeonato/status) exatamente como já faz hoje — o componente novo só recebe as listas já filtradas e agrupa por staff.

### Agrupamento (dentro do componente, via `useMemo`)

```ts
type StaffGroup = {
  staffId: string;
  name: string;
  pixKey: string;
  pixType: string;
  feePendingTotal: number;
  reimbPendingTotal: number;
  reimbByCategory: Array<{ category: string; total: number; paid: number }>; // só categorias com total > 0, ordenado desc por total
  totalToPay: number; // feePendingTotal + reimbPendingTotal
};
```

Só geram card os staffs que aparecem em `reimbursements` OU `fees` (mesmo comportamento das listas vazias de hoje: "Nenhum cachê lançado." / "Nenhum reembolso encontrado." — se as duas listas vierem vazias, mostrar essa mesma mensagem no lugar da grade de cards).

### O card

```
┌─────────────────────────────────────────────┐
│ João Silva                    [Ver detalhes]│
│ 📋 11999998888 (PIX)                         │
│                                               │
│ Cachê pendente:            R$ 1.200,00       │
│ Reembolso por categoria:                     │
│   Transporte      R$ 150,00                  │
│   Alimentação     R$  80,00                  │
│                                               │
│ Total a pagar:              R$ 1.430,00      │
│              [💸 Pagar tudo via PIX]         │
└─────────────────────────────────────────────┘
```

- "Cachê pendente" some se `feePendingTotal === 0`.
- "Reembolso por categoria" some se não houver nenhuma categoria com total > 0; cada linha usa `CATEGORY_LABEL` (mesmo mapa já usado em `admin.staffs.$staffId.tsx`/`admin.staffs.index.tsx`).
- "Total a pagar" só aparece se `totalToPay > 0`; se for zero, o card mostra só um resumo neutro (ex. "Sem pendências neste filtro") — staff só some do grid se não tiver NENHUM lançamento (nem pago nem pendente) no filtro atual, mas continua aparecendo (sem botão de pagar) se tiver só itens já pagos.
- "Ver detalhes": `Link to="/admin/staffs/$staffId" params={{staffId}}`.
- "💸 Pagar tudo via PIX": só renderiza quando **todas** as condições valem: `isMaster`, `totalToPay > 0`, e `championshipId !== null` (id específico, nunca a tela geral sem filtro). Chama `payStaffBalanceViaAsaas({ staff_id: staffId, championship_id: championshipId })` — mesmo fluxo de confirmação (favorecido + PIN) já usado hoje em `admin.staffs.$staffId.tsx` (`openPixConfirmation`/`beneficiaryDialog`/`pinDialog`/`AdminPinDialog`).

### Diálogos de confirmação (favorecido + PIN)

Esse par de diálogos + a função `openPixConfirmation` já está duplicado hoje entre `admin.staffs.index.tsx` e `admin.staffs.$staffId.tsx` (mesmo código, copiado). Pra não criar uma TERCEIRA cópia dentro de `StaffFinanceCards`, extrair um hook compartilhado:

`src/hooks/usePixConfirmation.tsx` — expõe `{ openPixConfirmation, dialogs }`, onde `dialogs` é o par `<Dialog>`/`<AdminPinDialog>` já prontos pra renderizar. `StaffFinanceCards` usa esse hook internamente (ele é o único lugar que precisa nesse componente).

`admin.staffs.index.tsx` e `admin.staffs.$staffId.tsx` continuam com suas cópias atuais por enquanto — migrá-los pro hook novo é uma limpeza futura, não faz parte deste plano (evita inflar o escopo).

### Comportamento de pagamento sem campeonato selecionado (tela geral)

- Filtro = "Todos os campeonatos" (`championship_id` do chamador é `"all"`): chamador passa `championshipId={null}` pro componente → cards mostram os totais (somados de todos os campeonatos que aparecem no filtro atual) mas sem botão de pagar.
- Filtro = um campeonato específico: chamador passa `championshipId={id}` → botão aparece.
- Dentro da aba do campeonato (`StaffTab`): `championshipId` é sempre o `id` da rota — botão sempre disponível (quando há pendência).

### O que muda de comportamento (importante)

As ações **por item individual** (excluir um reembolso específico, ver comprovante daquele item específico, "marcar pago manualmente" sem PIX real, editar o reembolso de um staff pelo admin — que já não existia) saem da lista/aba e passam a existir só dentro da tela de detalhe do staff (que já tem tudo isso, feito nas Tasks 4-6 do redesenho anterior). O card na lista é um resumo agregado com uma ação rápida (pagar tudo); ações granulares exigem entrar em "Ver detalhes".

## Testes/verificação

Mesma constraint do redesenho anterior: sem framework de testes automatizado no projeto. Verificação por task = `npx tsc --noEmit` sem erros novos + passo manual descrito.
