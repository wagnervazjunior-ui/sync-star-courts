import { useMemo, useState } from "react";
import { MatchCard, type MatchCardData, type TeamRef } from "./MatchCard";
import { MatchResultDialog } from "./MatchResultDialog";
import { MoveTeamDialog } from "./MoveTeamDialog";
import { useServerFn } from "@tanstack/react-start";
import { swapWithinMatch } from "@/lib/brackets.functions";
import { toast } from "sonner";

type Phase = "initial" | "final";

export function BracketView({
  matches,
  teams,
  format,
  phase,
  onRefresh,
}: {
  matches: MatchCardData[];
  teams: TeamRef[];
  format: "single_set" | "best_of_3_tiebreak";
  phase: Phase;
  onRefresh: () => void;
}) {
  const [selected, setSelected] = useState<MatchCardData | null>(null);
  const [moveCtx, setMoveCtx] = useState<{ match: MatchCardData; slot: "a" | "b" } | null>(null);
  const callSwapInside = useServerFn(swapWithinMatch);

  const handleSwapInside = async (m: MatchCardData) => {
    try {
      await callSwapInside({ data: { match_id: m.id } });
      toast.success("Duplas trocadas");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  };

  const cardProps = {
    teams,
    format,
    onOpenResult: (m: MatchCardData) => {
      if (m.team_a_id && m.team_b_id) setSelected(m);
    },
    onSwapInside: handleSwapInside,
    onMoveSlot: (m: MatchCardData, slot: "a" | "b") => setMoveCtx({ match: m, slot }),
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

  const content =
    phase === "initial" ? (
      <div className="space-y-10">
        <BracketSide
          title="Chave dos Ganhadores"
          rounds={byPhaseRound["WB"] ?? {}}
          accent="emerald"
          cardProps={cardProps}
        />
        <BracketSide
          title="Chave dos Perdedores"
          rounds={byPhaseRound["LB"] ?? {}}
          accent="amber"
          cardProps={cardProps}
        />
      </div>
    ) : (
      <FinalPhase byPhaseRound={byPhaseRound} cardProps={cardProps} />
    );

  return (
    <>
      {content}
      <MatchResultDialog
        open={!!selected}
        onClose={() => setSelected(null)}
        match={selected}
        teams={teams}
        format={format}
        onSaved={onRefresh}
      />
      <MoveTeamDialog
        open={!!moveCtx}
        onClose={() => setMoveCtx(null)}
        sourceMatch={moveCtx?.match ?? null}
        sourceSlot={moveCtx?.slot ?? "a"}
        allMatches={matches}
        teams={teams}
        onSaved={onRefresh}
      />
    </>
  );
}

function BracketSide({
  title,
  rounds,
  accent,
  cardProps,
}: {
  title: string;
  rounds: Record<number, MatchCardData[]>;
  accent: "emerald" | "amber";
  cardProps: any;
}) {
  const roundNums = Object.keys(rounds)
    .map((n) => parseInt(n, 10))
    .sort((a, b) => a - b);
  if (!roundNums.length)
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">Sem partidas nesta fase.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      <h3
        className={
          "text-sm font-semibold uppercase tracking-wider " +
          (accent === "emerald" ? "text-emerald-500" : "text-amber-500")
        }
      >
        {title}
      </h3>
      <div className="overflow-x-auto pb-3">
        <div className="flex min-w-fit items-stretch gap-0">
          {roundNums.map((r, idx) => (
            <RoundColumn
              key={r}
              roundLabel={`Rodada ${r}`}
              matches={rounds[r]}
              level={idx}
              cardProps={cardProps}
              showConnector={idx < roundNums.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FinalPhase({
  byPhaseRound,
  cardProps,
}: {
  byPhaseRound: Record<string, Record<number, MatchCardData[]>>;
  cardProps: any;
}) {
  const semi = byPhaseRound["SEMI"]?.[1] ?? [];
  const final = byPhaseRound["FINAL"]?.[1] ?? [];
  const third = byPhaseRound["THIRD"]?.[1] ?? [];

  if (!semi.length && !final.length)
    return <p className="text-sm text-muted-foreground">Fase Final será liberada ao concluir a fase inicial.</p>;

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto pb-3">
        <div className="flex min-w-fit items-stretch gap-0">
          <RoundColumn roundLabel="Semifinais" matches={semi} level={0} cardProps={cardProps} showConnector />
          <RoundColumn roundLabel="Final" matches={final} level={1} cardProps={cardProps} showConnector={false} />
        </div>
      </div>
      {third.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Disputa de 3º
          </h4>
          <div className="flex">
            {third.map((m) => (
              <MatchCard key={m.id} match={m} {...cardProps} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RoundColumn({
  roundLabel,
  matches,
  level,
  cardProps,
  showConnector,
}: {
  roundLabel: string;
  matches: MatchCardData[];
  level: number;
  cardProps: any;
  showConnector: boolean;
}) {
  // Espaçamento vertical entre partidas dobra a cada rodada para manter "chave"
  const gapPx = 16 * Math.pow(2, level);
  return (
    <div className="flex">
      <div className="flex flex-col">
        <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {roundLabel}
        </div>
        <div className="flex flex-col justify-around" style={{ gap: `${gapPx}px` }}>
          {matches.map((m) => (
            <div key={m.id} className="relative">
              <MatchCard match={m} {...cardProps} />
              {showConnector && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-0 top-1/2 h-px w-4 -translate-y-1/2 bg-border"
                />
              )}
            </div>
          ))}
        </div>
      </div>
      {showConnector && (
        <div className="flex flex-col justify-around" style={{ gap: `${gapPx}px` }}>
          {/* spacer column for connector */}
          {matches.map((m, i) => {
            const isTop = i % 2 === 0;
            const isBottom = i % 2 === 1;
            return (
              <div key={m.id} className="relative h-[64px] w-8">
                {(isTop || isBottom) && (
                  <span
                    aria-hidden
                    className={
                      "pointer-events-none absolute left-0 w-4 border-border " +
                      (isTop
                        ? "top-1/2 h-[calc(50%+" + gapPx / 2 + "px)] border-r border-b"
                        : "bottom-1/2 h-[calc(50%+" + gapPx / 2 + "px)] border-r border-t")
                    }
                  />
                )}
                {/* horizontal line into next round (only on pair midpoint) */}
                {isBottom && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-4 top-0 h-px w-4 bg-border"
                    style={{ top: `-${gapPx / 2}px` }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
