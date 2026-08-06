import { useMemo, useState } from "react";
import { MatchCard, type MatchCardData, type TeamRef } from "./MatchCard";
import { MatchResultDialog } from "./MatchResultDialog";
import { MoveTeamDialog } from "./MoveTeamDialog";
import { EditTeamDialog } from "./EditTeamDialog";
import { useServerFn } from "@tanstack/react-start";
import { swapWithinMatch, setMatchFormat } from "@/lib/brackets.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Phase = "initial" | "final";

const CARD_H = 97;
const BASE_GAP = 12;                    // gap between consecutive cards in round 0
const STEP_0 = CARD_H + BASE_GAP;       // 109 — center-to-center step in round 0
const ROUND_LABEL_H = 40;

// In round r: center-to-center step doubles each round → connectors always hit card centers
const getRoundStep   = (r: number) => Math.pow(2, r) * STEP_0;
const getRoundGap    = (r: number) => getRoundStep(r) - CARD_H;
// Each round shifts down so the first card aligns with the midpoint of round 0 pair r
const getRoundOffset = (r: number) => (Math.pow(2, r) - 1) * STEP_0 / 2;

export function BracketView({
  matches,
  teams,
  format,
  phase,
  courtCount = 0,
  onRefresh,
  onAssignCourt,
  onStartMatch,
  readonly = false,
}: {
  matches: MatchCardData[];
  teams: TeamRef[];
  format: "single_set" | "best_of_3_tiebreak";
  phase: Phase;
  courtCount?: number;
  onRefresh: () => void;
  onAssignCourt?: (matchId: string, court: number | null) => void;
  onStartMatch?: (matchId: string, started: boolean) => void;
  readonly?: boolean;
}) {
  const [selected, setSelected] = useState<MatchCardData | null>(null);
  const [moveCtx, setMoveCtx] = useState<{ match: MatchCardData; slot: "a" | "b" } | null>(null);
  const [editingTeam, setEditingTeam] = useState<TeamRef | null>(null);
  const callSwapInside = useServerFn(swapWithinMatch);
  const callSetFormat = useServerFn(setMatchFormat);

  const handleSwapInside = async (m: MatchCardData) => {
    if (readonly) return;
    try {
      await callSwapInside({ data: { match_id: m.id } });
      toast.success("Duplas trocadas");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  };

  const handleSetFormat = async (m: MatchCardData, matchFormat: "single_set" | "best_of_3_tiebreak" | null) => {
    if (readonly) return;
    try {
      await callSetFormat({ data: { match_id: m.id, match_format: matchFormat } });
      toast.success(matchFormat ? "Formato definido para esta partida" : "Voltou ao formato padrão da chave");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  };

  const cardProps = {
    teams,
    format,
    courtCount,
    onOpenResult: readonly ? undefined : (m: MatchCardData) => { if (m.team_a_id && m.team_b_id) setSelected(m); },
    onSwapInside: readonly ? undefined : handleSwapInside,
    onMoveSlot: readonly ? undefined : (m: MatchCardData, slot: "a" | "b") => setMoveCtx({ match: m, slot }),
    onAssignCourt: readonly || !onAssignCourt ? undefined : (m: MatchCardData, court: number | null) => onAssignCourt(m.id, court),
    onStartMatch: readonly || !onStartMatch ? undefined : (m: MatchCardData, started: boolean) => onStartMatch(m.id, started),
    onSetFormat: readonly ? undefined : handleSetFormat,
    onEditTeam: readonly ? undefined : (t: TeamRef) => setEditingTeam(t),
  };

  const byPhaseRound = useMemo(() => {
    const map: Record<string, Record<number, MatchCardData[]>> = {};
    for (const m of matches) {
      map[m.phase] ??= {};
      map[m.phase][m.round] ??= [];
      map[m.phase][m.round].push(m);
    }
    Object.values(map).forEach((rounds) =>
      Object.values(rounds).forEach((arr) => arr.sort((a, b) => a.position - b.position)),
    );
    return map;
  }, [matches]);

  const content = phase === "initial" ? (
    <div className="space-y-12">
      <BracketHalf title="Chave dos Vencedores" color="emerald" rounds={byPhaseRound["WB"] ?? {}} cardProps={cardProps} />
      <BracketHalf title="Chave dos Perdedores" color="amber" rounds={byPhaseRound["LB"] ?? {}} cardProps={cardProps} />
    </div>
  ) : (
    <FinalPhase byPhaseRound={byPhaseRound} cardProps={cardProps} />
  );

  return (
    <>
      {content}
      <MatchResultDialog open={!!selected} onClose={() => setSelected(null)} match={selected} teams={teams} format={selected?.match_format ?? format} onSaved={onRefresh} />
      <MoveTeamDialog open={!!moveCtx} onClose={() => setMoveCtx(null)} sourceMatch={moveCtx?.match ?? null} sourceSlot={moveCtx?.slot ?? "a"} allMatches={matches} teams={teams} onSaved={onRefresh} />
      <EditTeamDialog open={!!editingTeam} onClose={() => setEditingTeam(null)} team={editingTeam} onSaved={onRefresh} />
    </>
  );
}

// ─── Round label ──────────────────────────────────────────────────────────────

function getRoundLabel(roundNum: number, totalRounds: number, color: "emerald" | "amber", isFinalPhase = false): string {
  if (isFinalPhase) {
    if (totalRounds === 1) return "Grande Final";
    return roundNum === totalRounds ? "Grande Final" : "Semifinal";
  }
  if (color === "amber") return totalRounds === 1 ? "Fase Única" : `Fase ${roundNum}`;
  return totalRounds === 1 ? "Fase Única" : `Fase ${roundNum}`;
}

// ─── Section label ───────────────────────────────────────────────────────────

function SectionLabel({ title, color }: { title: string; color: "emerald" | "amber" }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={cn("h-4 w-1 rounded-full", color === "emerald" ? "bg-emerald-500" : "bg-amber-500")} />
      <h3 className={cn("text-sm font-semibold", color === "emerald" ? "text-emerald-500" : "text-amber-500")}>
        {title}
      </h3>
    </div>
  );
}

// ─── BracketHalf ─────────────────────────────────────────────────────────────

function BracketHalf({
  title, color, rounds, cardProps, isFinalPhase = false,
}: {
  title: string;
  color: "emerald" | "amber";
  rounds: Record<number, MatchCardData[]>;
  cardProps: any;
  isFinalPhase?: boolean;
}) {
  const roundNums = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const totalRounds = roundNums.length;

  if (!totalRounds) return (
    <div>
      <SectionLabel title={title} color={color} />
      <p className="text-xs text-muted-foreground">Sem partidas nesta chave.</p>
    </div>
  );

  // LB uses uniform spacing across all rounds (no branching doubling) because LB
  // rounds alternate between major (drop-in) and minor (consolidation) and the
  // count changes don't map cleanly to 2:1 branching like WB does.
  // WB uses the standard doubling offset so branching connectors align.
  const effectiveIndices: number[] = [];
  if (color === "amber" && !isFinalPhase) {
    roundNums.forEach(() => effectiveIndices.push(0));
  } else {
    let effIdx = 0;
    let prevCount = rounds[roundNums[0]]?.length ?? 0;
    for (let i = 0; i < roundNums.length; i++) {
      if (i === 0) { effectiveIndices.push(0); continue; }
      const curCount = rounds[roundNums[i]]?.length ?? 0;
      if (curCount < prevCount) effIdx++;
      effectiveIndices.push(effIdx);
      prevCount = curCount;
    }
  }

  return (
    <div>
      <SectionLabel title={title} color={color} />
      <div className="overflow-x-auto pb-4">
        <div className="flex items-start min-w-fit">
          {roundNums.map((r, idx) => {
            // LB: always use simple horizontal stubs — mixing of major/minor rounds
            //     means branching connectors would show wrong connections (e.g., LB-1-2
            //     appears to branch into LB-2-1 but actually feeds LB-2-2 when there are
            //     WB R2 drop-ins interleaved in lbPrev).
            // WB and final: always branching (clean 2:1 reduction each round).
            const simpleConnectors = color === "amber" && !isFinalPhase;

            return (
              <BracketRound
                key={r}
                label={getRoundLabel(r, totalRounds, color, isFinalPhase)}
                matches={rounds[r]}
                roundIndex={effectiveIndices[idx]}
                isLast={idx === totalRounds - 1}
                color={color}
                cardProps={cardProps}
                simpleConnectors={simpleConnectors}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── BracketRound (one column) ────────────────────────────────────────────────

function BracketRound({
  label, matches, roundIndex, isLast, color, cardProps, simpleConnectors = false,
}: {
  label: string;
  matches: MatchCardData[];
  roundIndex: number;
  isLast: boolean;
  color: "emerald" | "amber";
  cardProps: any;
  simpleConnectors?: boolean;
}) {
  const step   = getRoundStep(roundIndex);    // center-to-center distance between consecutive matches
  const gap    = getRoundGap(roundIndex);     // pixel gap between card edges
  const offset = getRoundOffset(roundIndex);  // paddingTop so this round aligns with previous connectors

  const pairs: MatchCardData[][] = [];
  for (let i = 0; i < matches.length; i += 2) pairs.push(matches.slice(i, i + 2));

  // Total pixel height of the matches area (from first card top to last card bottom)
  const areaH = matches.length > 0 ? offset + (matches.length - 1) * step + CARD_H : 0;

  return (
    <div className="flex items-start">
      {/* Match column — uniform gap between ALL consecutive cards in this round */}
      <div className="flex flex-col w-72">
        <div
          className={cn(
            "flex items-center justify-center text-xs font-bold uppercase tracking-widest shrink-0 rounded-md mx-1 mb-2",
            color === "emerald"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-amber-500/15 text-amber-400",
          )}
          style={{ height: ROUND_LABEL_H - 8 }}
        >
          {label}
        </div>
        <div className="flex flex-col" style={{ paddingTop: offset, gap }}>
          {matches.map((m) => <MatchCard key={m.id} match={m} {...cardProps} />)}
        </div>
      </div>

      {/* Connector column */}
      {!isLast && (
        <div className="relative shrink-0" style={{ width: 44, marginTop: ROUND_LABEL_H, height: areaH }}>
          {simpleConnectors ? (
            // LB: simple horizontal stub per match (branching connectors are wrong for LB
            // because rounds can increase in count due to carry byes)
            matches.map((_, j) => {
              const centerY = offset + j * step + CARD_H / 2;
              return (
                <div key={j} className="absolute bg-foreground/30"
                  style={{ left: 0, top: centerY - 0.5, width: 44, height: 1 }} />
              );
            })
          ) : (
            // WB: branching connectors — each pair of matches feeds one winner to next round
            pairs.map((pair, j) => {
              const topY = offset + 2 * j * step + CARD_H / 2;

              if (pair.length < 2) {
                return (
                  <div key={j} className="absolute bg-foreground/30"
                    style={{ left: 0, top: topY - 0.5, width: 44, height: 1 }} />
                );
              }

              const botY  = offset + (2 * j + 1) * step + CARD_H / 2;
              const spanH = botY - topY;

              return (
                <div key={j} className="absolute" style={{ left: 0, top: topY, width: 44, height: spanH }}>
                  <div className="absolute bg-foreground/30" style={{ left: 20, top: 0, width: 1, height: spanH }} />
                  <div className="absolute bg-foreground/30" style={{ left: 0, top: -0.5, width: 21, height: 1 }} />
                  <div className="absolute bg-foreground/30" style={{ left: 0, top: spanH - 0.5, width: 21, height: 1 }} />
                  <div className="absolute bg-foreground/30" style={{ left: 20, top: spanH / 2 - 0.5, width: 24, height: 1 }} />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Final Phase ─────────────────────────────────────────────────────────────

function FinalPhase({
  byPhaseRound, cardProps,
}: {
  byPhaseRound: Record<string, Record<number, MatchCardData[]>>;
  cardProps: any;
}) {
  const semi = byPhaseRound["SEMI"]?.[1] ?? [];
  const final = byPhaseRound["FINAL"]?.[1] ?? [];
  const third = byPhaseRound["THIRD"]?.[1] ?? [];

  if (!semi.length && !final.length)
    return <p className="text-sm text-muted-foreground">Fase Final será liberada ao concluir a fase inicial.</p>;

  const rounds: Record<number, MatchCardData[]> = {};
  if (semi.length) rounds[1] = semi;
  if (final.length) rounds[2] = final;

  return (
    <div className="space-y-8">
      <BracketHalf title="Fase Final" color="emerald" rounds={rounds} cardProps={cardProps} isFinalPhase />
      {third.length > 0 && (
        <div>
          <SectionLabel title="Disputa de 3º Lugar" color="amber" />
          <div className="flex gap-3 flex-wrap">
            {third.map((m) => <MatchCard key={m.id} match={m} {...cardProps} />)}
          </div>
        </div>
      )}
    </div>
  );
}
