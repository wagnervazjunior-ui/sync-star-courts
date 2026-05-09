## Objetivo

Reformar o fluxo de inscrição e o admin para refletir a realidade da operação de uniformes: dupla com nome próprio, modelos por campeonato, gênero por categoria, tamanhos separados de camiseta e shorts, e relatórios voltados ao pedido de uniformes.

---

## 1. Banco de dados (migration única)

**`championships`**
- `uniform_models text[] NOT NULL DEFAULT '{}'` — modelos de uniforme do campeonato (ex.: "Amador", "Convidados", "Profissional"), gerenciados pelo admin.

**`categories`**
- `gender text NOT NULL DEFAULT 'mixed'` com check em `('male','female','mixed')`.
- `uniform_model text` — modelo escolhido entre os do campeonato.

**`registrations`**
- `team_name text NOT NULL DEFAULT ''` (depois remover default).
- `contact_phone text NOT NULL DEFAULT ''` — único WhatsApp da dupla.
- `athlete1_shorts_size`, `athlete2_shorts_size` (`shirt_size`, mesma escala P/M/G/GG/XG; modelagem feminina é diferenciada via `gender` da categoria, não por nova escala).
- Remover (drop) `athlete1_phone` e `athlete2_phone`.
- Em mistas, `athlete1_*` = atleta masculino e `athlete2_*` = atleta feminina (convenção fixada no formulário e nos relatórios).

**RPC `create_registration`** atualizada para receber `team_name`, `contact_phone`, `athleteN_shirt_size`, `athleteN_shorts_size` e gravar nos novos campos.

**Política de vagas:** valor de vagas continua existindo, mas só é exibido para admin.

---

## 2. Admin — campeonato (`admin.campeonatos.index.tsx`)

No `ChampionshipDialog`, nova seção **Modelos de uniforme**: input + botão "Adicionar" que monta a lista `uniform_models` (chips removíveis). Persistir no array.

## 3. Admin — categorias

No formulário de categoria (no admin de campeonato):
- Select **Gênero**: Masculina / Feminina / Mista.
- Select **Modelo de uniforme**: opções vindas de `championships.uniform_models` do campeonato corrente.

## 4. Admin — listagem de inscrições / dashboard de categorias

- `admin.campeonatos.$id.tsx`: na lista de categorias mostrar `inscritos / max_slots` e `vagas restantes`. Cada categoria vira um link para a nova rota da categoria.
- Nova rota **`admin.categorias.$categoryId.tsx`** com:
  - Cabeçalho com nome da categoria, gênero, modelo, total inscritos, vagas restantes.
  - Tabela de inscrições (pendentes, confirmadas, canceladas) com colunas: Voucher, Status, Nome da dupla, WhatsApp, E-mail, Atleta 1 (camiseta/shorts), Atleta 2 (camiseta/shorts), Data.
  - Ações: confirmar / cancelar (já existem via RPC).
  - Botão "Exportar Excel desta categoria".

## 5. Admin — `admin.inscricoes.tsx` (Excel)

Manter visão geral mas reescrever a geração do Excel (planilha de uniformes):

- Apenas inscrições com `status = 'confirmed'`.
- Uma aba por categoria, no formato:
  - Cabeçalho: Categoria, Gênero, Modelo de uniforme.
  - Linhas com colunas exatamente nesta ordem: **Data da inscrição · Atleta 1 · Atleta 2 · Camiseta atleta 1 · Shorts atleta 1 · Camiseta atleta 2 · Shorts atleta 2 · Nome da dupla · Número do voucher**. (O pedido do usuário lista até "shorts atleta 1, nome da dupla, voucher" — assumimos que camiseta/shorts do atleta 2 entram na sequência simétrica antes do nome da dupla; confirmar se preferir esconder atleta 2.)
  - Bloco de **contagem de uniformes** por tamanho ao final da aba: `Camiseta P/M/G/GG/XG` e `Shorts P/M/G/GG/XG`. Em mistas, contagem separada Masculino/Feminino dentro da mesma aba.
- Aba final **"Resumo geral de uniformes"**:
  - Agregação de todos os tamanhos em todas as categorias confirmadas, separando por **modelagem** (Masculino vs Feminino — feminino inclui mulheres das mistas + categorias femininas; masculino inclui homens das mistas + categorias masculinas) e por **modelo de uniforme**.

## 6. Página pública do campeonato (`campeonatos.$slug.tsx`)

- Não exibir mais o número de vagas para o público. Mostrar apenas se está aberto/encerrado (sem números).
- Remover qualquer indicador "X vagas restantes" do card de categoria.

## 7. Formulário de inscrição (`inscricao.$categoryId.tsx`)

Reordenar os campos:
1. **E-mail de contato**.
2. **WhatsApp da dupla** (único, com máscara).
3. **Nome da dupla** (obrigatório).
4. Bloco **Atleta 1** / **Atleta 2** — sem telefone individual; com:
   - Nome completo.
   - Tamanho da **camiseta** (select).
   - Tamanho do **shorts** (select).
5. Para categorias **mistas**, os blocos viram **"Atleta masculino"** e **"Atleta feminina"** (rótulos fixos; ordem fixa: 1 = masculino, 2 = feminina). Para categorias masculinas/femininas usa "Atleta 1 / Atleta 2".
6. Manter aviso de garantia de tamanho e link para tabela de medidas (já existe).
7. Não exibir vagas restantes; manter tratamento de erro `SLOTS_FULL` no submit.

---

## Detalhes técnicos

- Migration em uma chamada: alter `championships`, `categories`, `registrations` + drop colunas antigas + recriar `create_registration`.
- Tipos do Supabase regenerados automaticamente.
- `confirm_registration_by_payment` mantém comportamento.
- Excel: usar `ExcelJS` (já no projeto). Sheet name truncada em 31 chars. Linhas de contagem destacadas em negrito.
- Página `admin.categorias.$categoryId.tsx` reusa componentes Card/Badge/Button.
- Tabela `registrations`: nenhum dado existente nesse momento de operação, então o drop de telefones individuais é seguro.

---

## Arquivos afetados

- `supabase/migrations/<timestamp>_uniform_overhaul.sql` (novo)
- `src/routes/admin.campeonatos.index.tsx` (modelos de uniforme + gênero/modelo nas categorias + contagem inscritos)
- `src/routes/admin.campeonatos.$id.tsx` (links pra página da categoria, contagem)
- `src/routes/admin.categorias.$categoryId.tsx` (novo)
- `src/routes/admin.inscricoes.tsx` (novo gerador Excel + filtros)
- `src/routes/campeonatos.$slug.tsx` (remover vagas)
- `src/routes/inscricao.$categoryId.tsx` (novos campos + ordem + rótulos por gênero)
- `src/integrations/supabase/types.ts` (auto)

