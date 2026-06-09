// Pure double-elimination bracket generator.
//
// Format: WB + LB each run until 2 teams remain (no WB Final / LB Final in
// the initial phase). Those 4 teams advance directly to the Fase Final as
// semi-finalists. The admin can rearrange the semi-final matchups via "Mover
// dupla". For very small brackets (size=4) a bye slot is used so the SEMI
// always has 4 slots.
//
// Phases: WB, LB, SEMI, FINAL, THIRD.

export type MatchPhase = "WB" | "LB" | "SEMI" | "FINAL" | "THIRD";

export type SourceRef =
  | { type: "seed"; seed: number }
  | { type: "winner_of"; key: string }
  | { type: "loser_of"; key: string }
  | { type: "bye" }
  | null;

export interface GeneratedMatch {
  key: string;
  phase: MatchPhase;
  round: number;
  position: number;
  source_a: SourceRef;
  source_b: SourceRef;
  bye: boolean;
}

// Standard seeding order (1vN, recursive).
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

export function generateDoubleElim(n: number): GeneratedMatch[] {
  if (n < 3) throw new Error("Mínimo 3 duplas");
  const size = nextPow2(n);
  const order = standardSeedOrder(size);
  const matches: GeneratedMatch[] = [];

  // ── WB Round 1 ────────────────────────────────────────────────────────────
  const wbRounds: string[][] = [];
  const r1Keys: string[] = [];
  for (let i = 0; i < size / 2; i++) {
    const s1 = order[i * 2];
    const s2 = order[i * 2 + 1];
    const key = `WB-1-${i + 1}`;
    const a: SourceRef = s1 <= n ? { type: "seed", seed: s1 } : { type: "bye" };
    const b: SourceRef = s2 <= n ? { type: "seed", seed: s2 } : { type: "bye" };
    matches.push({ key, phase: "WB", round: 1, position: i + 1, source_a: a, source_b: b, bye: a.type === "bye" || b.type === "bye" });
    r1Keys.push(key);
  }
  wbRounds.push(r1Keys);

  // ── WB Rounds 2..  — stop when 2 teams remain (no WB Final) ───────────────
  let prev = r1Keys;
  let wbRound = 2;
  while (prev.length > 2) {
    const cur: string[] = [];
    for (let i = 0; i < prev.length / 2; i++) {
      const key = `WB-${wbRound}-${i + 1}`;
      matches.push({ key, phase: "WB", round: wbRound, position: i + 1, source_a: { type: "winner_of", key: prev[i * 2] }, source_b: { type: "winner_of", key: prev[i * 2 + 1] }, bye: false });
      cur.push(key);
    }
    wbRounds.push(cur);
    prev = cur;
    wbRound++;
  }
  // prev has exactly 2 elements — the 2 WB semi-finalists
  const wbSemi: SourceRef[] = prev.map((k) => ({ type: "winner_of", key: k }));

  // ── LB ────────────────────────────────────────────────────────────────────
  // LB R1: pair WB-R1 losers (skip byes)
  const lbRounds: string[][] = [];
  const wbR1Losers = wbRounds[0]
    .map((k) => ({ key: k, bye: matches.find((m) => m.key === k)!.bye }))
    .filter((x) => !x.bye)
    .map((x) => x.key);

  const lbR1Keys: string[] = [];
  let lbRoundNum = 1;
  let lbCarry: SourceRef[] = [];

  if (wbR1Losers.length >= 2) {
    for (let i = 0; i < Math.floor(wbR1Losers.length / 2); i++) {
      const key = `LB-${lbRoundNum}-${i + 1}`;
      matches.push({ key, phase: "LB", round: lbRoundNum, position: i + 1, source_a: { type: "loser_of", key: wbR1Losers[i * 2] }, source_b: { type: "loser_of", key: wbR1Losers[i * 2 + 1] }, bye: false });
      lbR1Keys.push(key);
    }
  }
  if (wbR1Losers.length % 2 === 1) {
    lbCarry.push({ type: "loser_of", key: wbR1Losers[wbR1Losers.length - 1] });
  }
  let lbPrev: SourceRef[] = [...lbR1Keys.map((k) => ({ type: "winner_of", key: k } as SourceRef)), ...lbCarry];
  lbRounds.push(lbR1Keys);
  lbRoundNum++;

  // Major + minor rounds: drop losers from WB rounds 2..last into LB.
  // Stop MINOR in the last iteration so LB ends with 2 survivors (not 1).
  for (let w = 2; w <= wbRounds.length; w++) {
    const isLastDropIn = w === wbRounds.length;
    const wbLosers: SourceRef[] = wbRounds[w - 1].map((k) => ({ type: "loser_of", key: k }));

    const majorKeys: string[] = [];
    const matchCount = Math.min(lbPrev.length, wbLosers.length);
    for (let i = 0; i < matchCount; i++) {
      const key = `LB-${lbRoundNum}-${i + 1}`;
      matches.push({ key, phase: "LB", round: lbRoundNum, position: i + 1, source_a: lbPrev[i], source_b: wbLosers[wbLosers.length - 1 - i], bye: false });
      majorKeys.push(key);
    }
    lbRounds.push(majorKeys);
    lbRoundNum++;
    // Extras that had no opponent this major round advance with a bye
    const extraWb: SourceRef[] = wbLosers.length > lbPrev.length
      ? wbLosers.slice(0, wbLosers.length - lbPrev.length)
      : [];
    const extraLb: SourceRef[] = lbPrev.length > wbLosers.length
      ? lbPrev.slice(matchCount)
      : [];
    lbPrev = [
      ...majorKeys.map((k) => ({ type: "winner_of", key: k } as SourceRef)),
      ...extraWb,
      ...extraLb,
    ];

    // Skip MINOR in the last drop-in iteration so we keep 2 LB survivors
    if (!isLastDropIn && lbPrev.length > 1) {
      const minorKeys: string[] = [];
      const half = Math.floor(lbPrev.length / 2);
      for (let i = 0; i < half; i++) {
        const key = `LB-${lbRoundNum}-${i + 1}`;
        matches.push({ key, phase: "LB", round: lbRoundNum, position: i + 1, source_a: lbPrev[i * 2], source_b: lbPrev[i * 2 + 1], bye: false });
        minorKeys.push(key);
      }
      const tail: SourceRef[] = lbPrev.length % 2 === 1 ? [lbPrev[lbPrev.length - 1]] : [];
      lbRounds.push(minorKeys);
      lbRoundNum++;
      lbPrev = [...minorKeys.map((k) => ({ type: "winner_of", key: k } as SourceRef)), ...tail];
    }
  }

  // Extra consolidation (edge cases) — also stop at 2
  while (lbPrev.length > 2) {
    const minorKeys: string[] = [];
    const half = Math.floor(lbPrev.length / 2);
    for (let i = 0; i < half; i++) {
      const key = `LB-${lbRoundNum}-${i + 1}`;
      matches.push({ key, phase: "LB", round: lbRoundNum, position: i + 1, source_a: lbPrev[i * 2], source_b: lbPrev[i * 2 + 1], bye: false });
      minorKeys.push(key);
    }
    const tail: SourceRef[] = lbPrev.length % 2 === 1 ? [lbPrev[lbPrev.length - 1]] : [];
    lbRounds.push(minorKeys);
    lbRoundNum++;
    lbPrev = [...minorKeys.map((k) => ({ type: "winner_of", key: k } as SourceRef)), ...tail];
  }

  // lbPrev now has 1 or 2 LB semi-finalists
  // Pad to 2 with BYE if only 1 (e.g. 4-team bracket)
  while (lbPrev.length < 2) {
    lbPrev.push({ type: "bye" });
  }
  const lbSemi: SourceRef[] = lbPrev;

  // ── FASE FINAL: SEMI + FINAL + THIRD ──────────────────────────────────────
  // Default seeding: WB-top vs LB-bottom, WB-bottom vs LB-top.
  // Admin can rearrange via "Mover dupla" since slotMovable allows placed teams.
  matches.push({ key: "SEMI-1-1", phase: "SEMI", round: 1, position: 1, source_a: wbSemi[0], source_b: lbSemi[1], bye: lbSemi[1]?.type === "bye" });
  matches.push({ key: "SEMI-1-2", phase: "SEMI", round: 1, position: 2, source_a: wbSemi[1], source_b: lbSemi[0], bye: false });

  matches.push({ key: "FINAL-1-1", phase: "FINAL", round: 1, position: 1, source_a: { type: "winner_of", key: "SEMI-1-1" }, source_b: { type: "winner_of", key: "SEMI-1-2" }, bye: false });
  matches.push({ key: "THIRD-1-1", phase: "THIRD", round: 1, position: 1, source_a: { type: "loser_of", key: "SEMI-1-1" }, source_b: { type: "loser_of", key: "SEMI-1-2" }, bye: false });

  return matches;
}

// Evaluate a match result. Returns winner side ("a"|"b") or null.
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
  let aw = 0, bw = 0;
  for (const s of sets) {
    if (s.a === s.b) continue;
    if (s.a > s.b) aw++; else bw++;
    if (aw === 2) return "a";
    if (bw === 2) return "b";
  }
  return null;
}
