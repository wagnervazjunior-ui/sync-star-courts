// Pure double-elimination bracket generator — Challonge-compatible algorithm.
//
// LB R1 is built from WB R1 slot positions (not just real-match losers):
//   - Real WB R1 match → loser fills LB R1 at that slot position
//   - Bye WB R1 slot → position stays empty; that branch's WB R2 loser
//     waits for the cross-branch merge instead (see wb2Losers below)
//   - Same-origin pairing: pos_(2i-1) vs pos_(2i) — the two R1 losers who fed
//     the same WB R2 match play each other first, but ONLY when both slots
//     are filled (an "orphan" branch — neither R1 match had a bye). Mixed or
//     double-bye branches produce at most one waiting entry, no LB R1 match.
//   - Empty position (winner advanced past that slot, or bye) = no entry yet
//
// WB R2 losers from every branch merge one round later via doMajor, crossing
// branches (reversed order) whenever the WB has more than 2 rounds — matching
// Challonge (confirmed against real 13- and 14-team brackets; see
// docs/superpowers/specs/2026-08-05-lb-round1-cross-pairing-design.md). For
// small brackets where the WB has only 2 rounds, this is also the LAST
// drop-in, so `reversed=false` and same-branch pairing is used instead
// (intentional, matches Challonge for those sizes too — unchanged by this
// fix).
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

  // Step 3: Collect LB R1 pairings — pos (2i-1) vs pos (2i), i.e. the two WB R1
  // losers that fed the SAME WB R2 match play each other first in the losers
  // bracket (matches the reference double-elim templates: loser of game 1 vs
  // loser of game 2, not an anti-seeded cross to the opposite end of the
  // bracket). The anti-seed crossing still happens naturally one round later,
  // when LB R1 winners meet WB R2 losers in doMajor below.
  type LbEntry = { kind: "match"; a: SourceRef; b: SourceRef } | { kind: "bye"; src: SourceRef };
  const lbR1Entries: LbEntry[] = [];
  for (let i = 1; i <= size / 4; i++) {
    const posA = positions[2 * i - 1];
    const posB = positions[2 * i];
    if (posA !== null && posB !== null) lbR1Entries.push({ kind: "match", a: posA, b: posB });
    else if (posA !== null) lbR1Entries.push({ kind: "bye", src: posA });
    else if (posB !== null) lbR1Entries.push({ kind: "bye", src: posB });
  }

  const lbR1Keys: string[] = [];
  let lbPrev: SourceRef[] = [];
  let lbRoundNum = 1;

  for (const entry of lbR1Entries) {
    if (entry.kind === "match") {
      const key = `LB-${lbRoundNum}-${lbR1Keys.length + 1}`;
      matches.push({ key, phase: "LB", round: lbRoundNum, position: lbR1Keys.length + 1, source_a: entry.a, source_b: entry.b, bye: false });
      lbR1Keys.push(key);
      lbPrev.push({ type: "winner_of", key });
    } else {
      lbPrev.push(entry.src);
    }
  }
  if (lbR1Keys.length > 0) lbRoundNum++;

  // ── LB R2+: major/minor rounds ────────────────────────────────────────────

  // Minor round: sequential pairing (2i, 2i+1) — matches the visual connector
  // rendering which assumes adjacent matches feed the same next-round slot.
  const doMinor = () => {
    if (lbPrev.length <= 1) return;
    const minorKeys: string[] = [];
    const half = Math.floor(lbPrev.length / 2);
    for (let i = 0; i < half; i++) {
      const key = `LB-${lbRoundNum}-${i + 1}`;
      matches.push({ key, phase: "LB", round: lbRoundNum, position: i + 1, source_a: lbPrev[2 * i], source_b: lbPrev[2 * i + 1], bye: false });
      minorKeys.push(key);
    }
    const tail = lbPrev.length % 2 === 1 ? [lbPrev[lbPrev.length - 1]] : [];
    lbRoundNum++;
    lbPrev = [...minorKeys.map((k) => ({ type: "winner_of", key: k } as SourceRef)), ...tail];
  };

  // Helper: create a major round (WB losers drop in vs LB survivors).
  // `reversed` controls anti-seed crossing: highest LB survivor faces lowest
  // WB loser. This is correct for every drop-in EXCEPT the very last one
  // (the WB semifinal round's losers merging into the final LB survivors) —
  // by that point every LB lineage has already been cross-mixed, so crossing
  // again just pairs a team with a branch that already absorbed its own
  // semifinal opponent. The last drop-in instead pairs straight by index.
  const doMajor = (wbLosers: SourceRef[], reversed: boolean = true) => {
    const matchCount = Math.min(lbPrev.length, wbLosers.length);
    const majorKeys: string[] = [];
    for (let i = 0; i < matchCount; i++) {
      const key = `LB-${lbRoundNum}-${i + 1}`;
      const opponent = reversed ? wbLosers[wbLosers.length - 1 - i] : wbLosers[i];
      matches.push({ key, phase: "LB", round: lbRoundNum, position: i + 1, source_a: lbPrev[i], source_b: opponent, bye: false });
      majorKeys.push(key);
    }
    // Leftover WB losers that didn't get a match this round carry over to the
    // next round. Which end of `wbLosers` is "leftover" depends on which end
    // the matches above consumed from: `reversed` consumes from the END (so
    // the leftover is the FRONT); non-reversed consumes from the FRONT (so
    // the leftover is the END). Using the wrong end silently re-uses an
    // already-consumed WB loser as if it were still waiting, while dropping
    // the real leftover entirely — confirmed to corrupt n=5 (WB-2's loser
    // duplicated into an immediate SEMI rematch, the other WB-2 loser
    // vanishing) before this fix.
    const extraWb =
      wbLosers.length > lbPrev.length
        ? reversed
          ? wbLosers.slice(0, wbLosers.length - matchCount)
          : wbLosers.slice(matchCount)
        : [];
    const extraLb = lbPrev.length > wbLosers.length ? lbPrev.slice(matchCount) : [];
    lbRoundNum++;
    lbPrev = [...majorKeys.map((k) => ({ type: "winner_of", key: k } as SourceRef)), ...extraWb, ...extraLb];
  };

  // Merge every branch's R2 loser against whatever's ready from Step 3 above
  // (orphan-branch LB R1 winners + waiting single-branch R1 losers), reversed
  // to cross branches — same doMajor already used for later rounds below.
  if (wb2Losers.length > 0) {
    // This is the last drop-in when WB only has 2 rounds (no R3+ loop below).
    doMajor(wb2Losers, wbRounds.length > 2);
  }

  // Process WB R3 and beyond
  for (let w = 3; w <= wbRounds.length; w++) {
    const isLastDropIn = w === wbRounds.length;
    const wbLosers: SourceRef[] = wbRounds[w - 1].map((k) => ({ type: "loser_of", key: k }));

    // Pre-consolidation: reduce lbPrev if it outnumbers WB losers
    while (lbPrev.length > wbLosers.length) doMinor();

    doMajor(wbLosers, !isLastDropIn);

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
