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
  const isAdmin = !!(onOpenResult || onSwapInside || onMoveSlot);

  const teamA = teams.find((t) => t.id === match.team_a_id) ?? null;
  const teamB = teams.find((t) => t.id === match.team_b_id) ?? null;
  const seedA = teamA?.seed ?? (match.source_a?.type === "seed" ? match.source_a.seed : null);
  const seedB = teamB?.seed ?? (match.source_b?.type === "seed" ? match.source_b.seed : null);
  const nameA = teamA ? labelTeam(teamA) : describeSource(match.source_a, teams);
  const nameB = teamB ? labelTeam(teamB) : describeSource(match.source_b, teams);
  const winA = !!(match.winner_team_id && match.winner_team_id === match.team_a_id);
  const winB = !!(match.winner_team_id && match.winner_team_id === match.team_b_id);
  const ready = !!(teamA && teamB) && !match.winner_team_id;
  const { a: scoreA, b: scoreB } = aggregateScore(match.sets ?? [], format);

  const slotMovable = (slot: "a" | "b") => {
    if (match.winner_team_id) return false;
    const teamId = slot === "a" ? match.team_a_id : match.team_b_id;
    if (!teamId) return false;
    return true; // any placed team in an unplayed match can be moved
  };

  return (
    <div
      className={cn(
        "w-72 rounded-lg border bg-card text-xs shadow-sm transition select-none overflow-hidden",
        ready && !match.winner_team_id ? "border-primary/50" : "border-border",
        match.winner_team_id && "border-emerald-500/30",
        match.bye && !match.winner_team_id && "opacity-50",
      )}
    >
      {/* Header — admin-only: dropdown + trophy */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border/40 min-h-[24px]">
        <span className="text-xs font-bold tabular-nums text-foreground/50 select-none">
          #{match.position}
        </span>
        <div className="flex items-center gap-1">
          {match.winner_team_id && <Trophy className="size-3 text-emerald-500" />}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded p-0.5 hover:bg-muted/60 min-h-0 min-w-0" aria-label="Ações">
                <MoreVertical className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem disabled={!ready} onClick={() => onOpenResult?.(match)}>
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
                  Trocar dupla A ({nameA || "vaga A"})
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!slotMovable("b") || !match.team_b_id}
                  onClick={() => onMoveSlot?.(match, "b")}
                >
                  Trocar dupla B ({nameB || "vaga B"})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Row
        seed={seedA}
        name={nameA}
        score={scoreA}
        win={winA}
        lost={winB}
        onClick={() => onOpenResult?.(match)}
      />
      <div className="h-px bg-border/30" />
      <Row
        seed={seedB}
        name={nameB}
        score={scoreB}
        win={winB}
        lost={winA}
        onClick={() => onOpenResult?.(match)}
      />
    </div>
  );
}

function Row({
  seed,
  name,
  score,
  win,
  lost,
  onClick,
}: {
  seed: number | null;
  name: string;
  score: number | string;
  win: boolean;
  lost: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-2 py-2 text-left transition-colors min-h-0",
        win ? "bg-emerald-500/8 hover:bg-emerald-500/12" : "hover:bg-muted/30",
        lost && "opacity-60",
      )}
    >
      <span className="w-5 shrink-0 text-[10px] tabular-nums text-muted-foreground/60 text-right">
        {seed ?? "—"}
      </span>
      <span className={cn("flex-1 truncate text-xs", win ? "font-semibold text-foreground" : "text-foreground/80")}>
        {name}
      </span>
      <span
        className={cn(
          "min-w-[28px] text-center tabular-nums text-[11px] font-bold px-1.5 py-0.5 rounded",
          win
            ? "bg-emerald-500 text-white"
            : score === "-"
            ? "text-muted-foreground/30"
            : "text-amber-400",
        )}
      >
        {score}
      </span>
    </button>
  );
}
