## Objetivo

Reformular a página de detalhe da chave (`/admin/chaves/$bracketId`) para visual estilo Challonge/Pódio, com 3 sub-abas, edição manual de duplas e movimentação de duplas entre confrontos. Todos os termos em português.

## 1. Sub-abas na página da chave

Substituir o layout atual por `Tabs` com:

- **Fase Inicial** — chave de eliminatória dupla (Winners + Losers) renderizada em formato de chaveamento horizontal com linhas conectoras (SVG), igual ao modelo da imagem. Separação visual clara: bloco "Chave dos Ganhadores" em cima, "Chave dos Perdedores" embaixo (ou colunas adjacentes), cada coluna = uma rodada, com linhas tracejadas/curvas ligando o vencedor de um par à próxima caixa.
- **Fase Final** — apenas SEMI, FINAL e DISPUTA DE 3º, em formato mata-mata clássico (3 colunas com conectores).
- **Classificação** — tabela com posição (seed inicial), nome da dupla, vitórias, derrotas, status (ativa / eliminada / campeã / vice / 3º / 4º). Quando o torneio finaliza, mostra pódio destacado no topo.

A aba "Duplas (seeds)" atual vira parte da aba Classificação.

## 2. Visual de chave (estilo campeonato)

Reescrever `BracketView` para renderizar cada rodada como coluna fixa (`MatchCard` de altura uniforme), com um overlay SVG que desenha as linhas conectoras horizontais+verticais entre o lado direito de cada par e o lado esquerdo da caixa filha. Cada caixa de partida segue o padrão:

```text
┌──────────────────────┐
│ 1  Kau e Luan    19  │
│ 32 Cainã e menó  21  │
└──────────────────────┘
```

Seed à esquerda, nome no meio, placar à direita; vencedor destacado.

## 3. Adicionar dupla manualmente

Botão "Adicionar dupla" na aba Classificação. Abre dialog com nome/atleta1/atleta2. Cria registro em `bracket_teams` com próximo seed disponível. **Importante:** só permitido enquanto `status='live'` e nenhuma partida tiver resultado ainda — caso contrário regenerar a chave romperia o histórico. Mostrar aviso explicando.

Para chaves já em andamento, oferecer apenas "Substituir dupla" (trocar nome/atletas de um seed existente, sem mexer em confrontos).

## 4. Mover dupla entre confrontos

Cada `MatchCard` ganha menu de contexto (ícone "⋯") com:

- **Mover dupla A / dupla B para outro confronto** → abre dialog listando partidas elegíveis (mesmo phase, ainda sem resultado, com slot vazio ou outro time a trocar). Operação: swap entre dois slots de partidas distintas.
- **Trocar A↔B desta partida**.

Restrições: só permitido em partidas ainda **sem `winner_team_id`** e cujos slots estejam preenchidos por seed inicial (não por `winner_of`/`loser_of` de outra). Mover uma dupla que veio de propagação automática é bloqueado para não quebrar a árvore.

## 5. Termos em PT-BR

Renomear em toda a UI:

- WB → "Ganhadores"
- LB → "Perdedores"
- "Rodada N" mantém
- SEMI → "Semifinal", FINAL → "Final", THIRD → "Disputa de 3º"
- "Set único" / "Melhor de 3"

## Arquivos a alterar

**Backend** (`src/lib/brackets.functions.ts`):
- `addManualTeam({ bracket_id, team_name, athlete1_name, athlete2_name })` — valida que nenhum match tem resultado; insere com próximo seed; **não regenera estrutura** (a estrutura é fixa no momento da geração, então adicionar dupla só faz sentido antes de gerar; aviso na UI).
  - Alternativa adotada: limitar a "Substituir dupla" (`updateTeam`) quando já houver chave gerada.
- `updateTeam({ team_id, team_name, athlete1_name, athlete2_name })`.
- `swapMatchSlots({ match_a_id, slot_a: 'a'|'b', match_b_id, slot_b: 'a'|'b' })` — valida ambas as partidas sem winner e slots não-propagados; faz swap atômico.
- `swapWithinMatch({ match_id })` — troca team_a ↔ team_b da mesma partida.

**Frontend**:
- `src/routes/admin.chaves.$bracketId.tsx` — adicionar `Tabs` (Fase Inicial / Fase Final / Classificação).
- `src/components/brackets/BracketView.tsx` — reescrever para render tipo chave com SVG connectors; aceitar prop `phaseFilter: 'initial' | 'final'`.
- `src/components/brackets/MatchCard.tsx` — novo layout (seed | nome | placar), DropdownMenu com ações "Mover", "Trocar A↔B", "Lançar resultado".
- `src/components/brackets/MoveTeamDialog.tsx` (novo) — escolher partida destino.
- `src/components/brackets/ManualTeamDialog.tsx` (novo) — adicionar/editar dupla.
- `src/components/brackets/StandingsTab.tsx` (novo) — tabela de classificação + pódio + botão adicionar/editar dupla.

## Detalhes técnicos

- SVG connectors: container `relative`; cada coluna `flex flex-col justify-around`; após render, calcular posições com `useLayoutEffect` + `getBoundingClientRect` e desenhar `<path>` cúbicas entre `rightOf(parentA)+rightOf(parentB) → leftOf(child)`. Fallback simples: desenhar `<div>`s com borders L-shape entre colunas (mais barato e suficiente para visual de chave).
- Para Fase Inicial, render duas seções empilhadas: "Chave dos Ganhadores" (matches phase=WB) e "Chave dos Perdedores" (matches phase=LB), cada uma com suas próprias colunas/rodadas.
- Classificação: vitórias = count de matches com `winner_team_id = team.id`; derrotas = count de matches concluídos onde a dupla jogou e não venceu; status derivado (2+ derrotas = eliminada antes da fase final).
- Sem alterações no schema do banco; tudo via campos já existentes.