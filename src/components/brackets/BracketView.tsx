import { useMemo, useState } from "react";
import { MatchCard, type MatchCardData, type TeamRef } from "./MatchCard";
import { MatchResultDialog } from "./MatchResultDialog";

export function BracketView({
  matches,
  teams,
  format,
  onRefresh,
}: {
  matches: MatchCardData[];
  teams: TeamRef[];
  format: "single_set" | "best_of_3_tiebreak";
  onRefresh: () => void;
}) {
  const [selected, setSelected] = useState<MatchCardData | null>(null);

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

  const wb = byPhaseRound["WB"] ?? {};
  const lb = byPhaseRound["LB"] ?? {};
  const semi = byPhaseRound["SEMI"]?.[1] ?? [];
  const final = byPhaseRound["FINAL"]?.[1] ?? [];
  const third = byPhaseRound["THIRD"]?.[1] ?? [];

  const openMatch = (m: MatchCardData) => {
    if (m.team_a_id && m.team_b_id) setSelected(m);
  };

  return (
    <div className="space-y-10">
      <Phase title="Winners Bracket (WB)" rounds={wb} onClick={openMatch} teams={teams} accent="emerald" />
      <Phase title="Losers Bracket (LB)" rounds={lb} onClick={openMatch} teams={teams} accent="amber" />
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Fase Final</h3>
        <div className="flex flex-wrap gap-6">
          <Column label="Semifinais">
            {semi.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} onClick={() => openMatch(m)} />
            ))}
          </Column>
          <Column label="Final">
            {final.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} onClick={() => openMatch(m)} />
            ))}
          </Column>
          <Column label="Disputa de 3º">
            {third.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} onClick={() => openMatch(m)} />
            ))}
          </Column>
        </div>
      </div>
      <MatchResultDialog
        open={!!selected}
        onClose={() => setSelected(null)}
        match={selected}
        teams={teams}
        format={format}
        onSaved={onRefresh}
      />
    </div>
  );
}

function Phase({
  title,
  rounds,
  onClick,
  teams,
  accent,
}: {
  title: string;
  rounds: Record<number, MatchCardData[]>;
  onClick: (m: MatchCardData) => void;
  teams: TeamRef[];
  accent: "emerald" | "amber";
}) {
  const roundNums = Object.keys(rounds)
    .map((n) => parseInt(n, 10))
    .sort((a, b) => a - b);
  if (!roundNums.length) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="overflow-x-auto">
        <div className="flex gap-6 min-w-fit pb-2">
          {roundNums.map((r) => (
            <Column key={r} label={`Rodada ${r}`} accent={accent}>
              {rounds[r].map((m) => (
                <MatchCard key={m.id} match={m} teams={teams} onClick={() => onClick(m)} />
              ))}
            </Column>
          ))}
        </div>
      </div>
    </div>
  );
}

function Column({
  label,
  children,
  accent,
}: {
  label: string;
  children: React.ReactNode;
  accent?: "emerald" | "amber";
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className={
          "text-[10px] uppercase tracking-wider font-semibold " +
          (accent === "emerald"
            ? "text-emerald-500"
            : accent === "amber"
            ? "text-amber-500"
            : "text-muted-foreground")
        }
      >
        {label}
      </div>
      <div className="flex flex-col justify-around gap-3 min-h-[60px]">{children}</div>
    </div>
  );
}
