## 1. Editar categoria não preenche os campos
**Causa:** `CategoryDialog` usa `useState(() => initial ?? {...})` — só inicializa uma vez. Ao reabrir o diálogo com outra categoria, o form mantém o estado anterior.

**Correção em `src/routes/admin.campeonatos.$id.tsx`:**
- Forçar remontagem do diálogo passando `key={editing?.id ?? "new"}` no `<CategoryDialog />`, **ou** usar `useEffect` no componente para resetar o form quando `initial` mudar.
- Garantir que campos opcionais (`uniform_model`, `age_rule_mode`, `age_min`, `description`) caiam corretamente nos defaults quando vierem `null` do banco.

## 2. Data de nascimento aparecendo sem regra de idade
**Status:** o formulário em `src/routes/inscricao.$categoryId.tsx` já condiciona `{requiresAge && ...}`. Vou:
- Confirmar que o schema Zod não exige a data quando não há regra (já é `optional`, ok).
- Adicionar um pequeno guard: se `ctx.age_rule_mode` vier `null` (categorias antigas), tratar como `"none"`.
- Validar na prática abrindo a inscrição de uma categoria sem regra para confirmar a remoção total da seção.

## 3. Admin precisa editar a inscrição do atleta
Adicionar **edição completa** da inscrição na página `src/routes/admin.categorias.$categoryId.tsx`:
- Botão "Editar" (ícone lápis) na linha da tabela ao lado de Confirmar/Cancelar.
- Abrir um `<Dialog>` com formulário pré-preenchido: e-mail, WhatsApp, nome da dupla, nome / camiseta / shorts / data de nascimento de cada atleta.
- Salvar via `supabase.from("registrations").update(...)` (a policy `registrations_admin_update` já permite update do admin com `can_view_championship`).
- Reaproveitar máscara de WhatsApp e o seletor de tamanhos do formulário público.
- Invalidar a query `["adm-cat-regs", categoryId]` após salvar.

## 4. Contagem de uniformes incorreta na exportação
**Causa em `src/routes/admin.inscricoes.tsx` (`exportExcel`):**
```ts
const confirmed = (regs ?? []).filter(r => r.status === "confirmed");
```
Ignora os filtros aplicados (`championshipId`, `categoryId`, `status`, `search`). Resultado: a aba "Resumo geral" soma duplas de **outros campeonatos / categorias** que compartilham o mesmo `uniform_model` (ex.: "Amador"), inflando a contagem.

**Correção:**
- Trocar por `filtered` (já respeita todos os filtros) e considerar apenas `status === "confirmed"`.
- Quando `categoryId !== "all"`, exportar somente aquela categoria.
- Verificar também a página por-categoria (`admin.categorias.$categoryId.tsx`) — ela já passa só `[cat]` então a contagem nela está correta; vou apenas auditar o `renderBucket` para confirmar que cada atleta entra **uma única vez** no bucket de modelagem.

## Validação
- Editar uma categoria existente: confirmar que nome / vagas / preço / regra de idade aparecem preenchidos.
- Inscrever em categoria sem regra de idade: campo "Data de nascimento" não aparece.
- Editar uma inscrição como admin e ver as alterações persistirem.
- Exportar planilha com 1 dupla confirmada em "Amador": o Resumo geral mostra exatamente 2 (1 camiseta + 1 shorts por atleta).

## Arquivos alterados
- `src/routes/admin.campeonatos.$id.tsx` (reset do diálogo de categoria)
- `src/routes/admin.categorias.$categoryId.tsx` (edição de inscrição)
- `src/routes/admin.inscricoes.tsx` (exportação respeita filtros)
- `src/routes/inscricao.$categoryId.tsx` (guard `age_rule_mode` null)
