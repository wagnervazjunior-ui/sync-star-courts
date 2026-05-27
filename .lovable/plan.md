## Objetivo
Adicionar botão "Baixar planilha (Excel)" na página `/admin/staffs` que gera um `.xlsx` consolidando, por staff, os reembolsos e o cachê combinado, com totais e dados de PIX.

## Escopo da planilha

Filtro: por campeonato selecionado no admin (mesma seleção usada hoje para gerar links/listar cachês). Opcionalmente, um botão extra "Todos os campeonatos" para exportar geral.

Uma linha por staff (consolidado), colunas:

1. Nome do staff
2. CPF
3. Tipo de chave PIX
4. Chave PIX
5. Campeonato (ou "Vários" no modo geral)
6. Reembolsos — Aprovados (R$)
7. Reembolsos — Pendentes (R$)
8. Cachê combinado (R$)
9. Status do cachê (pendente/pago)
10. **Total a pagar (R$)** = Reembolsos aprovados + Cachê (fórmula Excel `=F2+H2`)
11. **Total geral (R$)** = Reembolsos (aprovados+pendentes) + Cachê

Linha final de totais com `SUM(...)` para colunas numéricas.

Valores em formato moeda `R$ #,##0.00;(R$ #,##0.00);-`.

## Implementação técnica

**1. Server function** em `src/lib/staff.functions.ts`:
- `exportStaffFinanceXlsx({ championshipId?: string })` com `requireSupabaseAuth`.
- Valida que o admin pode ver o campeonato (`can_view_championship`) ou é master.
- Busca staffs vinculados (via `staff_championships` quando filtrado, ou todos do admin owner quando geral), join com `staff_reimbursements` e `staff_fees`.
- Agrega em memória por staff: soma reembolsos por status, pega cachê único.
- Retorna `{ filename, base64 }` com o xlsx gerado.

**2. Geração do Excel**:
- Adicionar dependência `exceljs` (compatível com Worker runtime, JS puro).
- Cabeçalhos em negrito, larguras ajustadas, formato moeda nas colunas de valor, fórmulas `SUM` na última linha.

**3. UI em `src/routes/admin.staffs.tsx`**:
- Botão "Baixar Excel" ao lado dos botões existentes na seção de cachês/staffs.
- Ao clicar: chama a server fn, decodifica base64, dispara download via `Blob` + `URL.createObjectURL`.
- Toast de sucesso/erro.

## Arquivos alterados
- `src/lib/staff.functions.ts` — nova server fn `exportStaffFinanceXlsx`
- `src/routes/admin.staffs.tsx` — botão + handler de download
- `package.json` — adicionar `exceljs`

Sem mudanças de schema.