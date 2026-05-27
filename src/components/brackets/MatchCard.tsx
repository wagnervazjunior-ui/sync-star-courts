import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

export interface MatchCardData {
  id: string;
  phase: string;
  round: number;
  position: number;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_team_id: string | null;
  source_a: any;
  source_b: any;
  bye: boolean;
  sets: Array<{ a: number; b: number }>;
}

export interface TeamRef {
  id: string;
  seed: number;
  team_name: string;
  athlete1_name: string;
  athlete2_name: string;
}

function describeSource(src: any, teams: TeamRef[]): string {
  if (!src) return "—";
  if (src.type === "bye") return "BYE";
  if (src.type === "seed") {
    const t = teams.find((x) => x.seed === src.seed);
    return t ? labelTeam(t) : `Seed ${src.seed}`;
  }
  if (src.type === "winner_of") return `Vencedor ${src.key}`;
  if (src.type === "loser_of") return `Perdedor ${src.key}`;
  return "—";
}

export function labelTeam(t: TeamRef) {
  if (t.team_name) return t.team_name;
  const a = t.athlete1_name?.split(" ")[0] ?? "";
  const b = t.athlete2_name?.split(" ")[0] ?? "";
  return [a, b].filter(Boolean).join(" / ") || `Dupla ${t.seed}`;
}

export function MatchCard({
  match,
  teams,
  onClick,
}: {
  match: MatchCardData;
  teams: TeamRef[];
  onClick?: () => void;
}) {
  const teamA = teams.find((t) => t.id === match.team_a_id) ?? null;
  const teamB = teams.find((t) => t.id === match.team_b_id) ?? null;
  const nameA = teamA ? labelTeam(teamA) : describeSource(match.source_a, teams);
  const nameB = teamB ? labelTeam(teamB) : describeSource(match.source_b, teams);
  const winA = match.winner_team_id && match.winner_team_id === match.team_a_id;
  const winB = match.winner_team_id && match.winner_team_id === match.team_b_id;
  const ready = !!(teamA && teamB) && !match.winner_team_id;
  const scoreA = match.sets?.[0]?.a ?? "-";
  const scoreB = match.sets?.[0]?.b ?? "-";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-56 rounded-md border bg-card text-left text-xs shadow-sm transition",
        ready ? "border-primary/60 hover:border-primary" : "border-border",
        match.winner_team_id && "border-emerald-500/50",
        match.bye && !match.winner_team_id && "opacity-60",
      )}
    >
      <div className="border-b border-border/60 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-between">
        <span>
          {match.phase} R{match.round} · #{match.position}
        </span>
        {match.winner_team_id && <Trophy className="size-3 text-emerald-500" />}
      </div>
      <Row name={nameA} score={scoreA} win={!!winA} />
      <div className="h-px bg-border/40" />
      <Row name={nameB} score={scoreB} win={!!winB} />
    </button>
  );
}

function Row({ name, score, win }: { name: string; score: number | string; win: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-2 py-1.5",
        win ? "bg-emerald-500/10 font-semibold text-foreground" : "text-foreground/80",
      )}
    >
      <span className="truncate pr-2">{name}</span>
      <span className="tabular-nums text-foreground/90 w-5 text-right">{score}</span>
    </div>
  );
}
