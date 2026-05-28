// Pure double-elimination bracket generator.
// Estrutura: WB completo + LB completo. Encerra ao definir os 4 classificados
// (1º=W WB-Final, 2º=L WB-Final, 3º=W LB-Final, 4º=L LB-Final), depois Fase Final
// mata-mata: Semi1=1ºx4º, Semi2=2ºx3º, Final, Disputa de 3º.

export type MatchPhase = "WB" | "LB" | "SEMI" | "FINAL" | "THIRD";

export type SourceRef =
  | { type: "seed"; seed: number }
  | { type: "winner_of"; key: string }
  | { type: "loser_of"; key: string }
  | { type: "bye" }
  | null;

export interface GeneratedMatch {
  key: string; // ex "WB-1-3" (phase-round-position 1-indexed)
  phase: MatchPhase;
  round: number;
  position: number;
  source_a: SourceRef;
  source_b: SourceRef;
  bye: boolean;
}

// Pareamento padrão "standard seeding" (1vN, ..., recursivo).
export function standardSeedOrder(size: number): number[] {
  if (size === 1) return [1];
  const prev = standardSeedOrder(size / 2);
  const result: number[] = [];
  for (const s of prev) {
    result.push(s);
    result.push(size + 1 - s);
  }
  return result;
}

function nextPow2(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Gera somente a estrutura (chaves) — não consome banco.
// Para N duplas, devolve lista de matches WB + LB + SEMI + FINAL + THIRD.
export function generateDoubleElim(n: number): GeneratedMatch[] {
  if (n < 2) throw new Error("Mínimo 2 duplas");
  const size = nextPow2(n);
  const order = standardSeedOrder(size); // ex size=4 → [1,4,2,3]
  const matches: GeneratedMatch[] = [];

  // -------- WB Round 1 --------
  // pares consecutivos do order; se seed > n, oponente recebe bye
  const wbRounds: string[][] = [];
  const r1Keys: string[] = [];
  for (let i = 0; i < size / 2; i++) {
    const s1 = order[i * 2];
    const s2 = order[i * 2 + 1];
    const key = `WB-1-${i + 1}`;
    const a: SourceRef = s1 <= n ? { type: "seed", seed: s1 } : { type: "bye" };
    const b: SourceRef = s2 <= n ? { type: "seed", seed: s2 } : { type: "bye" };
    const bye = a.type === "bye" || b.type === "bye";
    matches.push({ key, phase: "WB", round: 1, position: i + 1, source_a: a, source_b: b, bye });
    r1Keys.push(key);
  }
  wbRounds.push(r1Keys);

  // -------- WB Rounds 2.. até a final do WB --------
  let prev = r1Keys;
  let round = 2;
  while (prev.length > 1) {
    const cur: string[] = [];
    for (let i = 0; i < prev.length / 2; i++) {
      const key = `WB-${round}-${i + 1}`;
      matches.push({
        key,
        phase: "WB",
        round,
        position: i + 1,
        source_a: { type: "winner_of", key: prev[i * 2] },
        source_b: { type: "winner_of", key: prev[i * 2 + 1] },
        bye: false,
      });
      cur.push(key);
    }
    wbRounds.push(cur);
    prev = cur;
    round++;
  }
  const wbFinalKey = prev[0];

  // -------- LB --------
  // Modelo padrão de double-elim:
  // LB rodadas alternam "minor" (consolidação entre perdedores do LB) e "major" (drop-in de perdedores do WB).
  // LB-R1: pareia perdedores do WB-R1 (descartando matches que foram bye — perdedor é "bye").
  const lbRounds: string[][] = [];
  const wbR1Losers = wbRounds[0]
    .map((k) => ({ key: k, bye: matches.find((m) => m.key === k)!.bye }))
    .filter((x) => !x.bye)
    .map((x) => x.key);

  // LB-R1: pareia perdedores do WB-R1 dois a dois; se número ímpar, último avança (bye no LB).
  const lbR1Keys: string[] = [];
  let lbRoundNum = 1;
  if (wbR1Losers.length >= 2) {
    for (let i = 0; i < Math.floor(wbR1Losers.length / 2); i++) {
      const key = `LB-${lbRoundNum}-${i + 1}`;
      matches.push({
        key,
        phase: "LB",
        round: lbRoundNum,
        position: i + 1,
        source_a: { type: "loser_of", key: wbR1Losers[i * 2] },
        source_b: { type: "loser_of", key: wbR1Losers[i * 2 + 1] },
        bye: false,
      });
      lbR1Keys.push(key);
    }
  }
  // sobrante (ímpar) — vira "carry" para próxima rodada do LB
  let lbCarry: SourceRef[] = [];
  if (wbR1Losers.length % 2 === 1) {
    lbCarry.push({ type: "loser_of", key: wbR1Losers[wbR1Losers.length - 1] });
  }
  let lbPrev: SourceRef[] = lbR1Keys.map((k) => ({ type: "winner_of", key: k }));
  lbPrev = [...lbPrev, ...lbCarry];
  lbRounds.push(lbR1Keys);
  lbRoundNum++;

  // A partir daqui alternamos:
  //   major round = drop-in dos perdedores do WB-R{w}
  //   minor round = consolidação interna do LB
  // até sobrar 1 finalista do LB.
  for (let w = 2; w < wbRounds.length; w++) {
    const wbLosers: SourceRef[] = wbRounds[w - 1].map((k) => ({ type: "loser_of", key: k }));
    // MAJOR: empareia cada participante do lbPrev com um perdedor do WB-R{w}
    // (espera-se mesmo número)
    const majorKeys: string[] = [];
    const len = Math.min(lbPrev.length, wbLosers.length);
    for (let i = 0; i < len; i++) {
      const key = `LB-${lbRoundNum}-${i + 1}`;
      matches.push({
        key,
        phase: "LB",
        round: lbRoundNum,
        position: i + 1,
        source_a: lbPrev[i],
        source_b: wbLosers[wbLosers.length - 1 - i], // reverso para evitar revanche imediata
        bye: false,
      });
      majorKeys.push(key);
    }
    lbRounds.push(majorKeys);
    lbRoundNum++;
    lbPrev = majorKeys.map((k) => ({ type: "winner_of", key: k }));

    // MINOR: se sobram >1, consolida
    if (lbPrev.length > 1) {
      const minorKeys: string[] = [];
      const half = Math.floor(lbPrev.length / 2);
      for (let i = 0; i < half; i++) {
        const key = `LB-${lbRoundNum}-${i + 1}`;
        matches.push({
          key,
          phase: "LB",
          round: lbRoundNum,
          position: i + 1,
          source_a: lbPrev[i * 2],
          source_b: lbPrev[i * 2 + 1],
          bye: false,
        });
        minorKeys.push(key);
      }
      const tail: SourceRef[] = lbPrev.length % 2 === 1 ? [lbPrev[lbPrev.length - 1]] : [];
      lbRounds.push(minorKeys);
      lbRoundNum++;
      lbPrev = [...minorKeys.map((k) => ({ type: "winner_of", key: k } as SourceRef)), ...tail];
    }
  }

  // se ainda restam >1 no LB, consolida sem drop-in (caso bordas)
  while (lbPrev.length > 1) {
    const minorKeys: string[] = [];
    const half = Math.floor(lbPrev.length / 2);
    for (let i = 0; i < half; i++) {
      const key = `LB-${lbRoundNum}-${i + 1}`;
      matches.push({
        key,
        phase: "LB",
        round: lbRoundNum,
        position: i + 1,
        source_a: lbPrev[i * 2],
        source_b: lbPrev[i * 2 + 1],
        bye: false,
      });
      minorKeys.push(key);
    }
    const tail: SourceRef[] = lbPrev.length % 2 === 1 ? [lbPrev[lbPrev.length - 1]] : [];
    lbRounds.push(minorKeys);
    lbRoundNum++;
    lbPrev = [...minorKeys.map((k) => ({ type: "winner_of", key: k } as SourceRef)), ...tail];
  }
  const lbFinalRef: SourceRef = lbPrev[0] ?? null;
  // descobre key do último match do LB (se houver) — usado para alimentar SEMIs
  // Encontra a referência: se lbFinalRef.type === "winner_of", a key alvo é lbFinalRef.key
  const lbFinalKey =
    lbFinalRef && lbFinalRef.type === "winner_of" ? lbFinalRef.key : null;

  // -------- FASE FINAL --------
  // 1º = vencedor do WB Final, 2º = perdedor do WB Final
  // 3º = vencedor do LB Final, 4º = perdedor do LB Final
  // Semi 1: 1º x 4º
  // Semi 2: 2º x 3º
  const fourthRef: SourceRef = lbFinalKey ? { type: "loser_of", key: lbFinalKey } : { type: "bye" };
  const thirdRef: SourceRef = lbFinalKey ? { type: "winner_of", key: lbFinalKey } : lbFinalRef;

  matches.push({
    key: "SEMI-1-1",
    phase: "SEMI",
    round: 1,
    position: 1,
    source_a: { type: "winner_of", key: wbFinalKey }, // 1º
    source_b: fourthRef, // 4º
    bye: false,
  });
  matches.push({
    key: "SEMI-1-2",
    phase: "SEMI",
    round: 1,
    position: 2,
    source_a: { type: "loser_of", key: wbFinalKey }, // 2º
    source_b: thirdRef, // 3º
    bye: false,
  });
  matches.push({
    key: "FINAL-1-1",
    phase: "FINAL",
    round: 1,
    position: 1,
    source_a: { type: "winner_of", key: "SEMI-1-1" },
    source_b: { type: "winner_of", key: "SEMI-1-2" },
    bye: false,
  });
  matches.push({
    key: "THIRD-1-1",
    phase: "THIRD",
    round: 1,
    position: 1,
    source_a: { type: "loser_of", key: "SEMI-1-1" },
    source_b: { type: "loser_of", key: "SEMI-1-2" },
    bye: false,
  });

  return matches;
}

// Avalia um conjunto de sets segundo formato. Retorna vencedor ("a"|"b") ou null se inválido/incompleto.
export function evaluateMatch(
  sets: Array<{ a: number; b: number }>,
  format: "single_set" | "best_of_3_tiebreak",
): "a" | "b" | null {
  if (!sets.length) return null;
  if (format === "single_set") {
    const s = sets[0];
    if (s.a === s.b) return null;
    return s.a > s.b ? "a" : "b";
  }
  // best_of_3_tiebreak: 2 sets ganhos
  let aw = 0;
  let bw = 0;
  for (const s of sets) {
    if (s.a === s.b) continue;
    if (s.a > s.b) aw++;
    else bw++;
    if (aw === 2) return "a";
    if (bw === 2) return "b";
  }
  return null;
}
