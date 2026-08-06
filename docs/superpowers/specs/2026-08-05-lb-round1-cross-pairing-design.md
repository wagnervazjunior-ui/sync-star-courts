# Corrigir pareamento da Fase 1 da chave de perdedores (LB Round 1)

## Contexto

`src/lib/brackets/generator.ts` gera a chave de dupla eliminação usada em todo o sistema (simulações, chaves reais, pagamento de premiação por colocação). A lógica de "quem enfrenta quem" na primeira leva de jogos da chave de perdedores (LB) está incorreta para praticamente todo tamanho de chave que não seja potência de 2 exata (9, 10, 11, 13, 14, 15, 17+ — a maioria dos casos reais).

**Causa raiz confirmada:** hoje, quando um "ramo" da chave (grupo de 2 partidas da rodada 1 que alimentam a mesma partida da rodada 2) tem um bye de um lado, o perdedor da rodada 2 daquele ramo é pareado direto contra o perdedor da rodada 1 do **mesmo ramo** (`positions[2i-1] vs positions[2i]` em `generator.ts:137-143`). O Challonge (referência usada desde o início do projeto) só faz esse pareamento imediato quando os **dois lados do ramo já estavam prontos ao mesmo tempo** (nenhum veio de bye — chamamos de "ramo órfão"). Quando um lado depende de bye, o Challonge não espera o parceiro original: ele junta **todos** os perdedores "prontos" de todos os ramos numa piscina só e cruza em ordem invertida — o mesmo princípio que a função `doMajor` já aplica corretamente nas rodadas seguintes.

**Evidência:** validado manualmente, jogo a jogo, contra duas chaves reais rodadas em paralelo no Challonge e no nosso sistema, com os mesmos resultados em cada jogo:
- **13 duplas** (1 ramo órfão): os 4 confrontos da "Fase 2" do Challonge batem exatamente com um cruzamento em ordem invertida entre (a) os perdedores da rodada 1 que ficaram esperando + o vencedor do ramo órfão, e (b) os perdedores da rodada 2 de todos os ramos.
- **14 duplas** (2 ramos órfãos simultâneos): mesmo padrão confirmado — cada ramo órfão joga sozinho primeiro, e o restante cruza entre ramos diferentes uma rodada depois.

## Objetivo

Fazer a Fase 1 (LB Round 1) da chave de perdedores coincidir exatamente com o Challonge para qualquer tamanho de chave, sem alterar o comportamento já correto das rodadas seguintes (`doMajor`/`doMinor`, que não mudam).

## Fora de escopo

- Qualquer mudança em como a chave de vencedores (WB) é construída — já bate exatamente com o Challonge (confirmado nos dois exemplos).
- Qualquer mudança na fase final (SEMI/FINAL/3º lugar) ou em `evaluateMatch`.
- Mudar a assinatura pública de `generateDoubleElim` ou o formato de `GeneratedMatch`.

## Design

### O que muda

**1. `positions[]` passa a guardar só perdedores reais da rodada 1 (Passo 1 não muda).**

**2. O Passo 2 simplifica radicalmente.** Hoje ele decide caso a caso (`bye1 && bye2`, `else if bye1`, `else if bye2`, `else`) onde cada perdedor da rodada 2 deveria ir — às vezes escrevendo direto em `positions[]` (forçando o pareamento "mesmo ramo" do Passo 3), às vezes mandando para `lbR2DirectEntries` (bypass). A correção: **todo perdedor da rodada 2, de todo ramo, sempre entra numa lista única `wb2Losers`, na ordem dos ramos** — nunca mais escreve em `positions[]`. Isso elimina a variável `lbR2DirectEntries` (substituída por `wb2Losers`, que agora cobre todos os ramos, não só os órfãos).

**3. O Passo 3 (loop que monta `lbR1Entries` a partir de `positions[]`) não muda uma linha de código** — mas como `positions[]` agora só é preenchido pelo Passo 1, o resultado passa a ser exatamente o que queremos, para os três casos possíveis de um ramo:
   - **Ramo órfão** (nenhum lado tinha bye): as duas posições estão preenchidas → vira uma partida real da Fase 1 (igual a hoje, sem mudança).
   - **Ramo misto** (um lado tinha bye): só uma posição preenchida → esse único perdedor avança sozinho como "bye" para a próxima etapa (esperando o cruzamento).
   - **Ramo com bye dos dois lados** (caso raro, ex.: 9 duplas): nenhuma posição preenchida → o ramo não contribui nada ainda; seu único perdedor (da rodada 2) só aparece depois, dentro de `wb2Losers`.

**4. O bloco `// Handle WB R2 direct entries` (`generator.ts:201-207`) é substituído por uma chamada única e incondicional:**

```ts
if (wb2Losers.length > 0) {
  doMajor(wb2Losers, wbRounds.length > 2);
}
```

Sem a consolidação prévia (`while (lbPrev.length > lbR2DirectEntries.length...) doMinor()`) que existe hoje — ela deixa de ser necessária porque `wb2Losers.length` agora cobre todos os ramos (normalmente igual a `lbPrev.length`, exceto quando há ramos com bye dos dois lados, caso em que `doMajor` já lida corretamente com a sobra via seu mecanismo existente de `extraWb`/`extraLb`, carregando o excedente pra próxima rodada).

O parâmetro `reversed = wbRounds.length > 2` **não muda** — é a mesma regra que já existe hoje pra saber se esse é o "último drop-in" (chaves bem pequenas, WB com só 2 rodadas), preservando o comportamento já correto desses casos.

### Por que isso não quebra nada que já funciona

- **Potência de 2 exata (8, 16, 32...):** todo ramo é órfão (não há bye). `positions[]` já ficava totalmente preenchido pelo Passo 1 hoje, e `wb2Losers` (novo) contém exatamente os mesmos itens que `lbR2DirectEntries` (antigo) continha nesse caso. Resultado idêntico, byte a byte.
- **Chaves bem pequenas onde a chave de vencedores só tem 2 rodadas (6, 7, 8):** `reversed` já era `false` nesse caso (`wbRounds.length > 2` = falso), e com `reversed=false` o cruzamento em ordem NÃO invertida entre `lbPrev` (na ordem dos ramos) e `wb2Losers` (na mesma ordem) produz o mesmo pareamento "mesmo ramo" que o código antigo já fazia propositalmente correto para esses tamanhos. Resultado idêntico.
- **Rodadas posteriores (`doMajor`/`doMinor` para WB R3+):** código completamente inalterado, continuam operando sobre `lbPrev` do mesmo jeito.

## Testes/verificação

Sem framework de testes automatizado no projeto. Verificação: escrever um script standalone (fora do pipeline da aplicação) que roda `generateDoubleElim(n)` pra vários `n` e imprime a estrutura resolvida, comparando manualmente contra:
1. Os dois casos já validados nesta investigação (13 e 14 duplas) — devem bater exatamente com os jogos reais documentados aqui.
2. Um caso de potência de 2 exata (16) e um caso pequeno (6 ou 7) — devem produzir a mesma estrutura de antes da mudança (sem regressão).
3. `npx tsc --noEmit` sem erros novos.
