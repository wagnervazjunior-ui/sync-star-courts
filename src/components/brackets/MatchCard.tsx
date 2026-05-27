import { cn } from "@/lib/utils";
import { MoreVertical, Trophy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export function labelTeam(t: TeamRef) {
  if (t.team_name) return t.team_name;
  const a = t.athlete1_name?.split(" ")[0] ?? "";
  const b = t.athlete2_name?.split(" ")[0] ?? "";
  return [a, b].filter(Boolean).join(" e ") || `Dupla ${t.seed}`;
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

function aggregateScore(
  sets: Array<{ a: number; b: number }>,
  format?: "single_set" | "best_of_3_tiebreak",
): { a: string | number; b: string | number } {
  if (!sets?.length) return { a: "-", b: "-" };
  if (format === "best_of_3_tiebreak") {
    let aw = 0;
    let bw = 0;
    for (const s of sets) {
      if (s.a > s.b) aw++;
      else if (s.b > s.a) bw++;
    }
    return { a: aw, b: bw };
  }
  return { a: sets[0].a, b: sets[0].b };
}

export function MatchCard({
  match,
  teams,
  format,
  onOpenResult,
  onSwapInside,
  onMoveSlot,
}: {
  match: MatchCardData;
  teams: TeamRef[];
  format?: "single_set" | "best_of_3_tiebreak";
  onOpenResult?: (m: MatchCardData) => void;
  onSwapInside?: (m: MatchCardData) => void;
  onMoveSlot?: (m: MatchCardData, slot: "a" | "b") => void;
}) {
  const teamA = teams.find((t) => t.id === match.team_a_id) ?? null;
  const teamB = teams.find((t) => t.id === match.team_b_id) ?? null;
  const seedA = teamA?.seed ?? (match.source_a?.type === "seed" ? match.source_a.seed : null);
  const seedB = teamB?.seed ?? (match.source_b?.type === "seed" ? match.source_b.seed : null);
  const nameA = teamA ? labelTeam(teamA) : describeSource(match.source_a, teams);
  const nameB = teamB ? labelTeam(teamB) : describeSource(match.source_b, teams);
  const winA = match.winner_team_id && match.winner_team_id === match.team_a_id;
  const winB = match.winner_team_id && match.winner_team_id === match.team_b_id;
  const ready = !!(teamA && teamB) && !match.winner_team_id;
  const { a: scoreA, b: scoreB } = aggregateScore(match.sets ?? [], format);

  const slotMovable = (slot: "a" | "b") => {
    const src = slot === "a" ? match.source_a : match.source_b;
    return !match.winner_team_id && (!src || src.type === "seed" || src.type === "bye");
  };

  return (
    <div
      className={cn(
        "w-64 rounded-md border bg-card text-xs shadow-sm transition select-none",
        ready ? "border-primary/60" : "border-border",
        match.winner_team_id && "border-emerald-500/40",
        match.bye && !match.winner_team_id && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>
          {match.phase} R{match.round} · #{match.position}
        </span>
        <div className="flex items-center gap-1">
          {match.winner_team_id && <Trophy className="size-3 text-emerald-500" />}
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded p-0.5 hover:bg-muted/60" aria-label="Ações">
              <MoreVertical className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem
                disabled={!ready}
                onClick={() => onOpenResult?.(match)}
              >
                Lançar resultado
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!match.winner_team_id || !match.team_a_id || !match.team_b_id}
                onClick={() => onSwapInside?.(match)}
              >
                Trocar A ↔ B desta partida
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!slotMovable("a") || !match.team_a_id}
                onClick={() => onMoveSlot?.(match, "a")}
              >
                Mover dupla A para outra partida
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!slotMovable("b") || !match.team_b_id}
                onClick={() => onMoveSlot?.(match, "b")}
              >
                Mover dupla B para outra partida
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Row seed={seedA} name={nameA} score={scoreA} win={!!winA} onClick={() => onOpenResult?.(match)} />
      <div className="h-px bg-border/40" />
      <Row seed={seedB} name={nameB} score={scoreB} win={!!winB} onClick={() => onOpenResult?.(match)} />
    </div>
  );
}

function Row({
  seed,
  name,
  score,
  win,
  onClick,
}: {
  seed: number | null;
  name: string;
  score: number | string;
  win: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left",
        win ? "bg-emerald-500/10 font-semibold text-foreground" : "text-foreground/80 hover:bg-muted/40",
      )}
    >
      <span className="inline-block w-6 shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {seed ?? "—"}
      </span>
      <span className="flex-1 truncate">{name}</span>
      <span className="w-6 text-right tabular-nums">{score}</span>
    </button>
  );
}
