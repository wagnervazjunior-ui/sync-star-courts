# Corrigir pareamento da Fase 1 da chave de perdedores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir `generateDoubleElim` em `src/lib/brackets/generator.ts` para que a primeira rodada da chave de perdedores cruze entre ramos diferentes (igual ao Challonge) em vez de parear sempre o mesmo ramo, para qualquer tamanho de chave.

**Architecture:** Substituir a etapa "Passo 2" (que hoje decide caso a caso onde cada perdedor da rodada 2 do WB vai, às vezes forçando pareamento no mesmo ramo) por uma coleta uniforme de todos os perdedores da rodada 2 numa lista só (`wb2Losers`), e trocar o bloco de merge que usava essa lista por uma chamada única a `doMajor` (função já existente, não muda).

**Tech Stack:** TypeScript puro, sem dependências novas.

## Global Constraints

- Sem framework de testes automatizado no projeto. Verificação: script standalone (`node`, fora do pipeline da aplicação) rodando a lógica pra vários tamanhos de chave e comparando contra os casos documentados na spec, mais `npx tsc --noEmit`.
- Não mudar a assinatura pública de `generateDoubleElim` nem o formato de `GeneratedMatch`.
- Não mudar nada em como a chave de vencedores (WB) é construída, nem na fase final (SEMI/FINAL/THIRD), nem em `evaluateMatch`.
- `doMajor` e `doMinor` (as funções já existentes) não mudam nenhuma linha — só mudam quais argumentos são passados pra `doMajor`.

---

### Task 1: Corrigir o pareamento da Fase 1 da chave de perdedores

**Files:**
- Modify: `src/lib/brackets/generator.ts`

**Interfaces:**
- Não muda: `generateDoubleElim(n: number): GeneratedMatch[]` continua com a mesma assinatura e mesmo formato de retorno.

- [ ] **Step 1: Substituir o Passo 2 (coleta de perdedores da rodada 2)**

Em `src/lib/brackets/generator.ts`, troque:

```ts
  // Step 2: WB R2 losers fill reserved bye-slot positions
  // lbR2DirectEntries = WB R2 losers from "real vs real" matches (bypass LB R1)
  const lbR2DirectEntries: SourceRef[] = [];

  if (wbRounds.length >= 2) {
    const wbR2Keys = wbRounds[1];
    for (let j = 0; j < wbR2Keys.length; j++) {
      const slot1 = 2 * j + 1; // 1-indexed
      const slot2 = 2 * j + 2;
      const bye1 = r1IsBye[slot1 - 1];
      const bye2 = r1IsBye[slot2 - 1];
      const loserRef: SourceRef = { type: "loser_of", key: wbR2Keys[j] };

      if (bye1 && bye2) {
        // Both byes: loser fills lower slot position; upper stays null (bye in LB R1)
        positions[slot1] = loserRef;
      } else if (bye1) {
        positions[slot1] = loserRef;
      } else if (bye2) {
        positions[slot2] = loserRef;
      } else {
        // Real vs real: loser bypasses LB R1, enters LB R2 directly
        lbR2DirectEntries.push(loserRef);
      }
    }
  }
```

Por:

```ts
  // Step 2: every WB R2 loser, from every branch, waits for the cross-branch
  // merge round below — never fills a position[] slot directly. Only a branch
  // where NEITHER R1 match had a bye ("orphan" branch, both positions filled
  // by Step 1) is ready to play immediately; every other branch's R2 loser
  // must wait for a teammate from a DIFFERENT branch (matches Challonge,
  // confirmed against real 13- and 14-team brackets — see
  // docs/superpowers/specs/2026-08-05-lb-round1-cross-pairing-design.md).
  const wb2Losers: SourceRef[] = [];
  if (wbRounds.length >= 2) {
    const wbR2Keys = wbRounds[1];
    for (let j = 0; j < wbR2Keys.length; j++) {
      wb2Losers.push({ type: "loser_of", key: wbR2Keys[j] });
    }
  }
```

- [ ] **Step 2: Substituir o bloco de merge ("Handle WB R2 direct entries")**

Troque:

```ts
  // Handle WB R2 direct entries (major round) if any
  if (lbR2DirectEntries.length > 0) {
    // Consolidate lbPrev first if oversized
    while (lbPrev.length > lbR2DirectEntries.length && lbPrev.length > 2) doMinor();
    // This is the last drop-in when WB only has 2 rounds (no R3+ loop below).
    doMajor(lbR2DirectEntries, wbRounds.length > 2);
  }
```

Por:

```ts
  // Merge every branch's R2 loser against whatever's ready from Step 3 above
  // (orphan-branch LB R1 winners + waiting single-branch R1 losers), reversed
  // to cross branches — same doMajor already used for later rounds below.
  if (wb2Losers.length > 0) {
    // This is the last drop-in when WB only has 2 rounds (no R3+ loop below).
    doMajor(wb2Losers, wbRounds.length > 2);
  }
```

Note que o Passo 3 (o loop que monta `lbR1Entries` a partir de `positions[]`, logo acima destes dois blocos) **não muda nenhuma linha** — ele já produz o resultado certo agora que `positions[]` só é preenchido pelo Passo 1.

- [ ] **Step 3: Criar o script de verificação standalone**

Crie um arquivo temporário fora do projeto (ex.: `/tmp/trace-brackets.mjs`, não faz parte do repositório) com esta função (cópia fiel de `generateDoubleElim` após a mudança, sem tipos TS, só pra rodar com `node` puro):

```js
function standardSeedOrder(size) {
  if (size === 1) return [1];
  const prev = standardSeedOrder(size / 2);
  const result = [];
  for (const s of prev) { result.push(s); result.push(size + 1 - s); }
  return result;
}
function nextPow2(n) { let p = 1; while (p < n) p *= 2; return p; }

function generateDoubleElim(n) {
  const size = nextPow2(n);
  const order = standardSeedOrder(size);
  const matches = [];
  const wbRounds = [];
  const r1Keys = [];
  const r1IsBye = [];
  for (let i = 0; i < size / 2; i++) {
    const s1 = order[i * 2], s2 = order[i * 2 + 1];
    const isBye = s1 > n || s2 > n;
    const key = `WB-1-${i + 1}`;
    matches.push({ key, phase: "WB", round: 1, position: i + 1,
      source_a: s1 <= n ? { type: "seed", seed: s1 } : { type: "bye" },
      source_b: s2 <= n ? { type: "seed", seed: s2 } : { type: "bye" }, bye: isBye });
    r1Keys.push(key); r1IsBye.push(isBye);
  }
  wbRounds.push(r1Keys);
  let prev = r1Keys, wbRound = 2;
  while (prev.length > 2) {
    const cur = [];
    for (let i = 0; i < prev.length / 2; i++) {
      const key = `WB-${wbRound}-${i + 1}`;
      matches.push({ key, phase: "WB", round: wbRound, position: i + 1,
        source_a: { type: "winner_of", key: prev[i * 2] }, source_b: { type: "winner_of", key: prev[i * 2 + 1] }, bye: false });
      cur.push(key);
    }
    wbRounds.push(cur); prev = cur; wbRound++;
  }
  const wbSemi = prev.map((k) => ({ type: "winner_of", key: k }));

  const positions = new Array(size / 2 + 1).fill(null);
  for (let i = 1; i <= size / 2; i++) if (!r1IsBye[i - 1]) positions[i] = { type: "loser_of", key: r1Keys[i - 1] };

  const wb2Losers = [];
  if (wbRounds.length >= 2) for (const k of wbRounds[1]) wb2Losers.push({ type: "loser_of", key: k });

  const lbR1Entries = [];
  for (let i = 1; i <= size / 4; i++) {
    const posA = positions[2 * i - 1], posB = positions[2 * i];
    if (posA !== null && posB !== null) lbR1Entries.push({ kind: "match", a: posA, b: posB });
    else if (posA !== null) lbR1Entries.push({ kind: "bye", src: posA });
    else if (posB !== null) lbR1Entries.push({ kind: "bye", src: posB });
  }
  const lbR1Keys = [];
  let lbPrev = [], lbRoundNum = 1;
  for (const entry of lbR1Entries) {
    if (entry.kind === "match") {
      const key = `LB-${lbRoundNum}-${lbR1Keys.length + 1}`;
      matches.push({ key, phase: "LB", round: lbRoundNum, position: lbR1Keys.length + 1, source_a: entry.a, source_b: entry.b, bye: false });
      lbR1Keys.push(key); lbPrev.push({ type: "winner_of", key });
    } else lbPrev.push(entry.src);
  }
  if (lbR1Keys.length > 0) lbRoundNum++;

  const doMinor = () => {
    if (lbPrev.length <= 1) return;
    const minorKeys = [];
    const half = Math.floor(lbPrev.length / 2);
    for (let i = 0; i < half; i++) {
      const key = `LB-${lbRoundNum}-${i + 1}`;
      matches.push({ key, phase: "LB", round: lbRoundNum, position: i + 1, source_a: lbPrev[2 * i], source_b: lbPrev[2 * i + 1], bye: false });
      minorKeys.push(key);
    }
    const tail = lbPrev.length % 2 === 1 ? [lbPrev[lbPrev.length - 1]] : [];
    lbRoundNum++;
    lbPrev = [...minorKeys.map((k) => ({ type: "winner_of", key: k })), ...tail];
  };
  const doMajor = (wbLosers, reversed = true) => {
    const matchCount = Math.min(lbPrev.length, wbLosers.length);
    const majorKeys = [];
    for (let i = 0; i < matchCount; i++) {
      const key = `LB-${lbRoundNum}-${i + 1}`;
      const opponent = reversed ? wbLosers[wbLosers.length - 1 - i] : wbLosers[i];
      matches.push({ key, phase: "LB", round: lbRoundNum, position: i + 1, source_a: lbPrev[i], source_b: opponent, bye: false });
      majorKeys.push(key);
    }
    const extraWb = wbLosers.length > lbPrev.length ? wbLosers.slice(0, wbLosers.length - lbPrev.length) : [];
    const extraLb = lbPrev.length > wbLosers.length ? lbPrev.slice(matchCount) : [];
    lbRoundNum++;
    lbPrev = [...majorKeys.map((k) => ({ type: "winner_of", key: k })), ...extraWb, ...extraLb];
  };

  if (wb2Losers.length > 0) doMajor(wb2Losers, wbRounds.length > 2);

  for (let w = 3; w <= wbRounds.length; w++) {
    const isLastDropIn = w === wbRounds.length;
    const wbLosers = wbRounds[w - 1].map((k) => ({ type: "loser_of", key: k }));
    while (lbPrev.length > wbLosers.length) doMinor();
    doMajor(wbLosers, !isLastDropIn);
    if (!isLastDropIn && lbPrev.length > 2) doMinor();
  }
  while (lbPrev.length > 2) doMinor();
  while (lbPrev.length < 2) lbPrev.push({ type: "bye" });
  const lbSemi = lbPrev;

  matches.push({ key: "SEMI-1-1", phase: "SEMI", round: 1, position: 1, source_a: wbSemi[0], source_b: lbSemi[1], bye: lbSemi[1]?.type === "bye" });
  matches.push({ key: "SEMI-1-2", phase: "SEMI", round: 1, position: 2, source_a: wbSemi[1], source_b: lbSemi[0], bye: false });
  matches.push({ key: "FINAL-1-1", phase: "FINAL", round: 1, position: 1, source_a: { type: "winner_of", key: "SEMI-1-1" }, source_b: { type: "winner_of", key: "SEMI-1-2" }, bye: false });
  matches.push({ key: "THIRD-1-1", phase: "THIRD", round: 1, position: 1, source_a: { type: "loser_of", key: "SEMI-1-1" }, source_b: { type: "loser_of", key: "SEMI-1-2" }, bye: false });
  return matches;
}

function fmt(ref) {
  if (!ref) return "—";
  if (ref.type === "seed") return `Seed${ref.seed}`;
  if (ref.type === "bye") return "BYE";
  if (ref.type === "winner_of") return `V(${ref.key})`;
  if (ref.type === "loser_of") return `P(${ref.key})`;
  return "?";
}
for (const n of [6, 7, 9, 13, 14, 16]) {
  console.log(`\n########## n=${n} ##########`);
  const matches = generateDoubleElim(n);
  for (const m of matches.filter((m) => m.phase === "LB")) {
    console.log(`  ${m.key} (round ${m.round}): ${fmt(m.source_a)}  x  ${fmt(m.source_b)}`);
  }
}
```

- [ ] **Step 4: Rodar e conferir contra os casos documentados**

Run: `node /tmp/trace-brackets.mjs`

Para **n=13**, confirme que a saída de `LB-1-*` (round 1) mostra **só uma partida** (`P(WB-1-3) x P(WB-1-4)`, o ramo órfão), e que a saída de `LB-2-*` (round 2) mostra as 4 partidas cruzadas:
- `P(WB-2-1) x P(WB-1-8)`
- `P(WB-2-3) x V(LB-1-1)` (o vencedor do ramo órfão)
- `P(WB-2-4) x P(WB-1-2)`
- `P(WB-2-2) x P(WB-1-6)`

(a ordem exata de cada par pode sair invertida — o que importa é que cada perdedor da rodada 2 aparece pareado com um perdedor de um ramo **diferente** do seu, não do próprio ramo. Compare com a Fase 2 real documentada na spec: Dupla1×Dupla6, Dupla2×Dupla4, Dupla3×Dupla9, Dupla5×Dupla10 — mapeando Dupla1=Seed1 [ramo do WB-2-1], Dupla6=P(WB-1-8), etc.)

Para **n=14**, confirme que `LB-1-*` mostra **duas partidas** (os dois ramos órfãos), e que a rodada seguinte cruza os 4 perdedores da rodada 2 contra os 2 vencedores dos ramos órfãos + os 2 perdedores de rodada 1 que sobraram — nenhum par "mesmo ramo".

Para **n=16**, confirme que a estrutura de `LB-1-*`/`LB-2-*` é **idêntica** à gerada antes da mudança (4 partidas reais em round 1, todas de ramos órfãos, já que não há bye nenhum) — sem regressão.

Para **n=6** e **n=7**, confirme que o pareamento de `LB-1-*` continua sendo "mesmo ramo" (já que `wbRounds.length` é 2 nesses tamanhos, então `reversed=false`, preservando o comportamento já correto de antes).

Se qualquer uma dessas conferências não bater, **pare e reavalie antes de prosseguir** — não ajuste o código de produção sem entender a causa da diferença.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep generator`
Expected: nenhuma linha de erro nova (o projeto tem erros pré-existentes não relacionados em outros arquivos — ignore).

- [ ] **Step 6: Commit**

```bash
git add src/lib/brackets/generator.ts
git commit -m "$(cat <<'EOF'
Corrigir pareamento da Fase 1 da chave de perdedores (cruzar ramos)

Bug: quando um ramo da chave tinha bye de um lado, o perdedor da
rodada 2 daquele ramo jogava direto contra o perdedor da rodada 1 do
MESMO ramo. O Challonge só faz esse pareamento imediato quando os dois
lados do ramo já estavam prontos ao mesmo tempo (ramo "órfão", sem
bye) — do contrário, cruza com perdedores de ramos diferentes, uma
rodada depois, igual ao doMajor que já usamos nas rodadas seguintes.

Confirmado jogo a jogo contra duas chaves reais rodadas em paralelo no
Challonge (13 e 14 duplas, mesmos resultados nos dois sistemas) — ver
docs/superpowers/specs/2026-08-05-lb-round1-cross-pairing-design.md.

Sem mudança de comportamento pra potências de 2 exatas (8/16/32) nem
pra chaves pequenas (6/7/8) — só afeta tamanhos com bye E mais de 2
rodadas na chave de vencedores.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Depois da task

Este fix só afeta chaves **novas**, geradas a partir de agora — chaves já existentes no banco (criadas antes desta correção) mantêm a estrutura antiga, já persistida. Isso não faz parte deste plano; se o usuário quiser corrigir chaves já criadas, é uma decisão separada (precisaria decidir se regenera do zero ou não).

```bash
npm run build
./node_modules/.bin/wrangler deploy
git push origin main
```

Confirmar em produção: simular uma chave nova de 13 duplas em `/admin/chaves` e conferir visualmente que a Fase 1 da chave de perdedores tem só 1 confronto (o ramo órfão), não 4.
