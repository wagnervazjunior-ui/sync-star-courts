## Visão geral

Gerador de chaves de futevolei seguindo a lógica observada no Podio Sports / Estação Open:

1. **Fase de dupla eliminatória** (Winners + Losers Bracket) — para todas as duplas inscritas, encerra ao restar 4.
2. **Fase Final mata-mata** — Semi 1: 1º vs 4º, Semi 2: 2º vs 3º, Final (W1 vs W2) e Disputa de 3º (L1 vs L2).
3. **Formato de set configurável por categoria** — set único (placar livre) ou melhor de 3 com tiebreak de 15 pts.

Disponível em dois lugares (conforme escolha "Ambos"):
- **Aba "Chaves"** dentro de `/admin/campeonatos/$id` → gera/gerencia por categoria do campeonato, usando as inscrições confirmadas como duplas.
- **Página avulsa** `/admin/chaves` → admin informa N duplas (ou cola lista), gera uma chave de teste/preview sem víncular ao banco de campeonatos.

Seeds: por ranking/inscrição. Cada dupla ganha um `seed` (ordem) que o admin pode reordenar antes de gerar. Default = ordem de inscrição (`registrations.created_at`).

Visualização: render próprio em React + SVG (sem Challonge). Layout em colunas (rodadas) para WB e LB lado a lado, mais bloco Fase Final.

---

## Mudanças no banco

Nova migration cria:

**`brackets`** — uma chave por (categoria, edição). Permite regerar arquivando a anterior.
- `category_id` (uuid, FK conceitual), `championship_id`, `name`, `match_format` enum (`single_set` | `best_of_3_tiebreak`), `tiebreak_points` int default 15, `target_score` int (pontos do set único, ex 18), `status` enum (`draft` | `live` | `finished`), `current_phase` enum (`double_elim` | `final_four`), `created_by`, timestamps.

**`bracket_teams`** — duplas dentro da chave.
- `bracket_id`, `seed` int, `team_name`, `athlete1_name`, `athlete2_name`, `registration_id` (nullable, link opcional para `registrations`), `eliminated` bool, `final_rank` int nullable.

**`bracket_matches`** — partidas (WB, LB, semi, final, 3º lugar).
- `bracket_id`, `phase` enum (`WB` | `LB` | `SEMI` | `FINAL` | `THIRD`), `round` int, `position` int (posição na rodada),
- `team_a_id` / `team_b_id` (nullable enquanto não definidos),
- `source_a` jsonb / `source_b` jsonb (descreve de onde vem a dupla: `{type:"seed",seed:1}` ou `{type:"winner_of",match_id}` ou `{type:"loser_of",match_id}`),
- `bye` bool,
- `sets` jsonb (lista de `{a,b}`), `winner_team_id` nullable, `played_at` nullable.

**`bracket_avulso`** opcional — não. Vamos manter a página avulsa apenas em memória/localStorage (sem persistência), já que persistência ficou para o caminho via campeonato. Se o admin quiser salvar, exporta JSON.

RLS: todas com `no_direct` para anon/authenticated; operações via server fns com `requireSupabaseAuth` e checagem `can_view_championship`.

Grants para `authenticated` e `service_role`.

---

## Algoritmo do gerador

Entrada: lista de N duplas ordenadas por seed (1..N).

1. **Calcular bracket size** = próxima potência de 2 ≥ N. `byes = size - N`.
2. **Pareamento WB R1** (padrão Challonge):
   - Sequência padrão de seeds para size = 2^k usando algoritmo recursivo de "interleaving" (1vN, N/2 vs N/2+1, etc.). Para 16 confere com os exemplos coletados: 1v16, 8v9, 4v13, 5v12, 2v15, 7v10, 3v14, 6v11.
   - Top seeds com posição cujo oponente seria > N recebem **bye** automático (avançam direto para R2).
3. **Construir grafo do WB** até restar 2 duplas (final do WB).
4. **Construir LB** com fluxo padrão de eliminação dupla:
   - LB R1 recebe perdedores do WB R1.
   - LB R2 = vencedor de LB R1 × perdedor de WB R2 (alternando posições para evitar revanche imediata).
   - Continua até sobrar 1 dupla no LB (final do LB).
5. **Encerramento da fase de dupla eliminatória** ao definir os 4 classificados:
   - 1º = vencedor do WB Final
   - 2º = perdedor do WB Final
   - 3º = vencedor do LB Final
   - 4º = perdedor do LB Final
   (Diferente do double-elim "puro" do Challonge: aqui não há Grand Final — corte explicitamente nas semis.)
6. **Gerar Fase Final**:
   - Semi 1: 1º × 4º
   - Semi 2: 2º × 3º
   - Final: W(Semi1) × W(Semi2)
   - 3º Lugar: L(Semi1) × L(Semi2)

Geração armazena toda a topologia em `bracket_matches` com `source_a/source_b` apontando os predecessores; quando um match recebe `sets` e o vencedor é calculado, server fn propaga o `winner_team_id` para os matches dependentes.

---

## Server functions (`src/lib/brackets.functions.ts`)

Todas com `requireSupabaseAuth` e checagem de admin do campeonato:

- `listBrackets({ championship_id })` — chaves do campeonato (uma por categoria).
- `getBracket({ bracket_id })` — bracket + teams + matches.
- `createBracket({ category_id, match_format, target_score })` — cria draft, popula teams a partir de `registrations` confirmadas (seed = ordem de criação), gera todos os matches via algoritmo.
- `updateTeamSeeds({ bracket_id, order: [team_id...] })` — reordena seeds antes de o bracket virar `live`. Após `live`, bloqueado.
- `recordMatchResult({ match_id, sets: [{a,b}...] })` — valida formato (single set ou melhor de 3 + tiebreak 15), calcula vencedor, marca em `bracket_matches`, propaga para matches dependentes, e ao detectar conclusão do LB/WB Final preenche slots da Semi e atualiza `current_phase` para `final_four`.
- `resetMatch({ match_id })` — limpa sets + winner + propaga limpeza nos descendentes.
- `regenerateBracket({ bracket_id })` — arquiva (`status=draft`?) e recria. Só permitido se nenhum match tem placar.
- `deleteBracket({ bracket_id })`.

Helpers puros (em `src/lib/brackets/generator.ts`) testáveis sem banco:
- `standardSeedPairs(size)` → ordem 1v16, 8v9, …
- `buildDoubleElimGraph(seeds, byes)` → estrutura WB + LB matches.
- `evaluateMatch(sets, format)` → `{winner: "a"|"b"|null, valid: boolean}`.

---

## UI

### Aba "Chaves" em `/admin/campeonatos/$id`

Nova tab ao lado de "Categorias", "Inscrições", "Staff":
- Lista categorias do campeonato com badge ("Sem chave" / "Em andamento" / "Finalizada").
- Botão **Gerar chave** abre dialog: escolhe `match_format` (set único com pts ou MD3+TB15), confirma quantidade de duplas confirmadas, gera.
- Clicar na categoria → tela do bracket com:
  - Header: nome da categoria, formato, status, ações (Reordenar seeds antes de iniciar; Iniciar chave; Regenerar; Excluir).
  - Visualização: componente `<BracketView />` em SVG/HTML — colunas verticais por rodada, conectores entre matches, cards com nome das duplas e placar editável (admin clica → popup pra registrar sets).
  - Painel **Fase Final** abaixo, oculto até os 4 classificados serem definidos.

### Página avulsa `/admin/chaves`

- Formulário simples: textarea com uma dupla por linha (ou input "número de duplas N" gera placeholders Dupla 1..N).
- Mesmas opções de formato.
- Botão **Gerar** monta a estrutura em memória e renderiza com o mesmo `<BracketView />`. Sem persistência. Botão "Exportar JSON" / "Imprimir".

### Componente `<BracketView />` (`src/components/brackets/BracketView.tsx`)

- Recebe `{ teams, matches, onRecordResult }`.
- Agrupa matches por `phase` + `round`, renderiza colunas SVG com linhas conectoras (`<path>` curvas Bezier curtas).
- Cards de match em HTML absolutamente posicionados sobre o SVG, usando tokens de design (`bg-card`, `border`, `text-foreground`).
- Responsivo: scroll horizontal em telas pequenas, viewport fixa em desktop.
- Variantes visuais para WB (acento `primary`), LB (acento `muted`), Final Four (acento `accent`).

---

## Arquivos

**Novos:**
- `supabase/migrations/<ts>_brackets.sql` — tabelas + enums + grants + RLS.
- `src/lib/brackets/generator.ts` — algoritmo puro.
- `src/lib/brackets/generator.test.ts` — testes (16, 18, 24, 32 duplas; valida seed pairs e topologia).
- `src/lib/brackets.functions.ts` — server fns.
- `src/components/brackets/BracketView.tsx` — visualização.
- `src/components/brackets/MatchCard.tsx`, `MatchResultDialog.tsx` — auxiliares.
- `src/routes/admin.chaves.tsx` — página avulsa.
- `src/routes/admin.campeonatos.$id.chaves.$bracketId.tsx` — tela detalhe do bracket (ou modal dentro da aba).

**Editados:**
- `src/routes/admin.campeonatos.$id.tsx` — adicionar tab "Chaves" (similar à tab "Staff" recém criada).
- `src/routes/admin.tsx` — adicionar item de menu "Chaves (avulsas)".

---

## Detalhes técnicos relevantes

- Cálculo do vencedor do set único: validar `max(a,b) >= target_score` e diferença ≥ 1 (ou regra customizável); manter simples por enquanto.
- MD3+TB15: 2 sets ganhos vencem; se 1-1, terceiro set é tiebreak até 15.
- Propagação: ao gravar resultado, percorrer descendentes via `source_a/source_b` e atualizar `team_a_id`/`team_b_id`. Se descendente já tinha resultado, recusar (precisa `resetMatch` antes).
- Bye é tratado como match com `bye=true`, `winner_team_id` = team com seed, sem permitir edição.
- Realtime opcional (futuro): habilitar `bracket_matches` em `supabase_realtime` para acompanhamento ao vivo. Não escopo desta entrega.

---

## Fora de escopo (próximos passos)

- View pública do bracket para inscritos/espectadores.
- Geração de PDF / impressão dedicada.
- Suporte a fase de grupos round-robin antes da eliminatória dupla (algumas categorias do Podio usam isso).
- Realtime via Supabase channels.
