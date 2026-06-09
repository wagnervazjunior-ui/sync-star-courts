// Pure double-elimination bracket generator — Challonge-compatible algorithm.
//
// LB R1 is built from WB R1 slot positions (not just real-match losers):
//   - Real WB R1 match → loser fills LB R1 at that slot position
//   - Bye WB R1 slot → position reserved for whoever loses the WB R2 match
//     that involves the bye winner (same "slot zone")
//   - Anti-seeded pairing: pos_i vs pos_(size/2+1-i)
//   - Empty position (winner advanced past that slot) = bye in LB R1
//
// After LB R1, minor rounds consolidate survivors before each WB drop-in.

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
  const r1IsBye: boolean[] = [];

  for (let i = 0; i < size / 2; i++) {
    const s1 = order[i * 2];
    const s2 = order[i * 2 + 1];
    const isBye = s1 > n || s2 > n;
    const key = `WB-1-${i + 1}`;
    const a: SourceRef = s1 <= n ? { type: "seed", seed: s1 } : { type: "bye" };
    const b: SourceRef = s2 <= n ? { type: "seed", seed: s2 } : { type: "bye" };
    matches.push({ key, phase: "WB", round: 1, position: i + 1, source_a: a, source_b: b, bye: isBye });
    r1Keys.push(key);
    r1IsBye.push(isBye);
  }
  wbRounds.push(r1Keys);

  // ── WB Rounds 2+ — stop when 2 remain ────────────────────────────────────
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
  const wbSemi: SourceRef[] = prev.map((k) => ({ type: "winner_of", key: k }));

  // ── LB R1: Challonge slot-based algorithm ────────────────────────────────
  // positions[i] = who fills LB R1 slot i (1-indexed, size/2 total)
  const positions: (SourceRef | null)[] = new Array(size / 2 + 1).fill(null);

  // Step 1: WB R1 real-match losers fill their slot directly
  for (let i = 1; i <= size / 2; i++) {
    if (!r1IsBye[i - 1]) {
      positions[i] = { type: "loser_of", key: r1Keys[i - 1] };
    }
  }

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

  // Step 3: Anti-seeded LB R1 pairings — pos i vs pos (size/2 + 1 - i)
  const lbR1Keys: string[] = [];
  let lbPrev: SourceRef[] = [];
  let lbRoundNum = 1;

  for (let i = 1; i <= size / 4; i++) {
    const posA = positions[i];
    const posB = positions[size / 2 + 1 - i];
    if (posA !== null && posB !== null) {
      const key = `LB-${lbRoundNum}-${lbR1Keys.length + 1}`;
      matches.push({ key, phase: "LB", round: lbRoundNum, position: lbR1Keys.length + 1, source_a: posA, source_b: posB, bye: false });
      lbR1Keys.push(key);
      lbPrev.push({ type: "winner_of", key });
    } else if (posA !== null) {
      lbPrev.push(posA); // bye: posA advances
    } else if (posB !== null) {
      lbPrev.push(posB); // bye: posB advances
    }
  }
  if (lbR1Keys.length > 0) {
    // push even if some positions were empty — round exists
    const allLbR1: string[] = [];
    for (let i = 1; i <= size / 4; i++) {
      const posA = positions[i];
      const posB = positions[size / 2 + 1 - i];
      if (posA !== null && posB !== null) allLbR1.push(`LB-${lbRoundNum}-${allLbR1.length + 1}`);
    }
    lbRoundNum++;
  } else if (lbPrev.length > 0) {
    // All byes in LB R1 (very small bracket), no matches created but survivors exist
  }

  // ── LB R2+: major/minor rounds ────────────────────────────────────────────

  // Helper: create a minor round (survivors pair among themselves)
  const doMinor = () => {
    if (lbPrev.length <= 1) return;
    const minorKeys: string[] = [];
    const half = Math.floor(lbPrev.length / 2);
    // Anti-seeded within minor: pair 0 vs last, 1 vs second-to-last, etc.
    for (let i = 0; i < half; i++) {
      const key = `LB-${lbRoundNum}-${i + 1}`;
      matches.push({ key, phase: "LB", round: lbRoundNum, position: i + 1, source_a: lbPrev[i], source_b: lbPrev[lbPrev.length - 1 - i], bye: false });
      minorKeys.push(key);
    }
    const tail = lbPrev.length % 2 === 1 ? [lbPrev[Math.floor(lbPrev.length / 2)]] : [];
    lbRoundNum++;
    lbPrev = [...minorKeys.map((k) => ({ type: "winner_of", key: k } as SourceRef)), ...tail];
  };

  // Helper: create a major round (WB losers drop in vs LB survivors)
  const doMajor = (wbLosers: SourceRef[]) => {
    const matchCount = Math.min(lbPrev.length, wbLosers.length);
    const majorKeys: string[] = [];
    for (let i = 0; i < matchCount; i++) {
      const key = `LB-${lbRoundNum}-${i + 1}`;
      // Anti-seed: highest LB survivor faces lowest WB loser (reversed wbLosers)
      matches.push({ key, phase: "LB", round: lbRoundNum, position: i + 1, source_a: lbPrev[i], source_b: wbLosers[wbLosers.length - 1 - i], bye: false });
      majorKeys.push(key);
    }
    const extraWb = wbLosers.length > lbPrev.length ? wbLosers.slice(0, wbLosers.length - lbPrev.length) : [];
    const extraLb = lbPrev.length > wbLosers.length ? lbPrev.slice(matchCount) : [];
    lbRoundNum++;
    lbPrev = [...majorKeys.map((k) => ({ type: "winner_of", key: k } as SourceRef)), ...extraWb, ...extraLb];
  };

  // Handle WB R2 direct entries (major round) if any
  if (lbR2DirectEntries.length > 0) {
    // Consolidate lbPrev first if oversized
    while (lbPrev.length > lbR2DirectEntries.length && lbPrev.length > 2) doMinor();
    doMajor(lbR2DirectEntries);
  }

  // Process WB R3 and beyond
  for (let w = 3; w <= wbRounds.length; w++) {
    const isLastDropIn = w === wbRounds.length;
    const wbLosers: SourceRef[] = wbRounds[w - 1].map((k) => ({ type: "loser_of", key: k }));

    // Pre-consolidation: reduce lbPrev if it outnumbers WB losers
    while (lbPrev.length > wbLosers.length) doMinor();

    doMajor(wbLosers);

    // After major, if not last, consolidate for the next drop-in
    if (!isLastDropIn && lbPrev.length > 2) doMinor();
  }

  // Extra consolidation for edge cases
  while (lbPrev.length > 2) doMinor();

  // Pad to 2 if needed (very small brackets)
  while (lbPrev.length < 2) lbPrev.push({ type: "bye" });

  const lbSemi = lbPrev;

  // ── Fase Final ────────────────────────────────────────────────────────────
  matches.push({ key: "SEMI-1-1", phase: "SEMI", round: 1, position: 1, source_a: wbSemi[0], source_b: lbSemi[1], bye: lbSemi[1]?.type === "bye" });
  matches.push({ key: "SEMI-1-2", phase: "SEMI", round: 1, position: 2, source_a: wbSemi[1], source_b: lbSemi[0], bye: false });
  matches.push({ key: "FINAL-1-1", phase: "FINAL", round: 1, position: 1, source_a: { type: "winner_of", key: "SEMI-1-1" }, source_b: { type: "winner_of", key: "SEMI-1-2" }, bye: false });
  matches.push({ key: "THIRD-1-1", phase: "THIRD", round: 1, position: 1, source_a: { type: "loser_of", key: "SEMI-1-1" }, source_b: { type: "loser_of", key: "SEMI-1-2" }, bye: false });

  return matches;
}

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
