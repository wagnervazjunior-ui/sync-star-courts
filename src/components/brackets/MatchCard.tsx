import { cn } from "@/lib/utils";
import { MapPin, MoreVertical, Play, Square, Trophy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  court_number: number | null;
  started_at: string | null;
  match_format?: "single_set" | "best_of_3_tiebreak" | null;
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
  courtCount = 0,
  onOpenResult,
  onSwapInside,
  onMoveSlot,
  onAssignCourt,
  onStartMatch,
  onSetFormat,
  onEditTeam,
}: {
  match: MatchCardData;
  teams: TeamRef[];
  format?: "single_set" | "best_of_3_tiebreak";
  courtCount?: number;
  onOpenResult?: (m: MatchCardData) => void;
  onSwapInside?: (m: MatchCardData) => void;
  onMoveSlot?: (m: MatchCardData, slot: "a" | "b") => void;
  onAssignCourt?: (m: MatchCardData, court: number | null) => void;
  onStartMatch?: (m: MatchCardData, started: boolean) => void;
  onSetFormat?: (m: MatchCardData, format: "single_set" | "best_of_3_tiebreak" | null) => void;
  onEditTeam?: (team: TeamRef) => void;
}) {
  const isAdmin = !!(onOpenResult || onSwapInside || onMoveSlot || onAssignCourt || onStartMatch || onSetFormat || onEditTeam);

  const teamA = teams.find((t) => t.id === match.team_a_id) ?? null;
  const teamB = teams.find((t) => t.id === match.team_b_id) ?? null;
  const seedA = teamA?.seed ?? (match.source_a?.type === "seed" ? match.source_a.seed : null);
  const seedB = teamB?.seed ?? (match.source_b?.type === "seed" ? match.source_b.seed : null);
  const nameA = teamA ? labelTeam(teamA) : describeSource(match.source_a, teams);
  const nameB = teamB ? labelTeam(teamB) : describeSource(match.source_b, teams);
  const winA = !!(match.winner_team_id && match.winner_team_id === match.team_a_id);
  const winB = !!(match.winner_team_id && match.winner_team_id === match.team_b_id);
  const ready = !!(teamA && teamB) && !match.winner_team_id;
  const effectiveFormat = match.match_format ?? format;
  const { a: scoreA, b: scoreB } = aggregateScore(match.sets ?? [], effectiveFormat);

  const isFinished = !!match.winner_team_id;
  const isInProgress = !isFinished && !!match.started_at;
  const isScheduled = !isFinished && !isInProgress && !!match.court_number;

  const slotMovable = (slot: "a" | "b") => {
    if (match.winner_team_id) return false;
    const teamId = slot === "a" ? match.team_a_id : match.team_b_id;
    if (!teamId) return false;
    return true;
  };

  const courtBadge = isScheduled || isInProgress
    ? `Quadra ${match.court_number}`
    : null;

  return (
    <div
      className={cn(
        "w-72 rounded-lg border bg-card text-xs shadow-sm transition select-none overflow-hidden",
        // Estados visuais (prioridade decrescente)
        isFinished && "border-emerald-500/30",
        isInProgress && !isFinished && "border-green-500 ring-1 ring-green-500/30 bg-green-500/5",
        isScheduled && !isInProgress && !isFinished && "border-blue-500 ring-1 ring-blue-500/30 bg-blue-500/5",
        !isFinished && !isInProgress && !isScheduled && ready && "border-primary/50",
        !isFinished && !isInProgress && !isScheduled && !ready && "border-border",
        match.bye && !match.winner_team_id && "opacity-50",
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-2 py-1 border-b min-h-[24px]",
        isInProgress ? "border-green-500/30 bg-green-500/10" : isScheduled ? "border-blue-500/30 bg-blue-500/10" : "border-border/40",
      )}>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold tabular-nums text-foreground/50 select-none">
            #{match.position}
          </span>
          {courtBadge && (
            <span className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5",
              isInProgress ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400",
            )}>
              <MapPin className="size-2.5" />
              {courtBadge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isFinished && <Trophy className="size-3 text-emerald-500" />}

          {/* Botão play/stop — visível quando quadra definida e jogo não terminado */}
          {isAdmin && onStartMatch && !isFinished && !!match.court_number && (
            <button
              type="button"
              title={isInProgress ? "Pausar jogo" : "Iniciar jogo"}
              onClick={() => onStartMatch(match, !isInProgress)}
              className={cn(
                "rounded p-0.5 transition-colors",
                isInProgress
                  ? "text-green-400 hover:bg-green-500/20"
                  : "text-muted-foreground/60 hover:bg-muted/60 hover:text-green-400",
              )}
            >
              {isInProgress ? <Square className="size-3 fill-current" /> : <Play className="size-3 fill-current" />}
            </button>
          )}

          {/* Ícone de quadra — abre popover para seleção */}
          {isAdmin && onAssignCourt && !isFinished && courtCount > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Definir quadra"
                  className={cn(
                    "rounded p-0.5 transition-colors",
                    isScheduled || isInProgress
                      ? "text-blue-400 hover:bg-blue-500/20"
                      : "text-muted-foreground/60 hover:bg-muted/60 hover:text-blue-400",
                  )}
                >
                  <MapPin className="size-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="end">
                <p className="text-xs font-semibold mb-2 text-muted-foreground">Definir quadra</p>
                <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                  {Array.from({ length: courtCount }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onAssignCourt(match, match.court_number === n ? null : n)}
                      className={cn(
                        "w-8 h-8 rounded text-xs font-bold transition-colors border",
                        match.court_number === n
                          ? "bg-blue-500 text-white border-blue-500"
                          : "border-border hover:border-blue-400 hover:text-blue-400",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                  {match.court_number && (
                    <button
                      type="button"
                      onClick={() => onAssignCourt(match, null)}
                      className="px-2 h-8 rounded text-[10px] border border-destructive/50 text-destructive/70 hover:bg-destructive/10 transition-colors"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

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
                {onEditTeam && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled={!teamA} onClick={() => teamA && onEditTeam(teamA)}>
                      Editar dupla A ({nameA || "vaga A"})
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={!teamB} onClick={() => teamB && onEditTeam(teamB)}>
                      Editar dupla B ({nameB || "vaga B"})
                    </DropdownMenuItem>
                  </>
                )}
                {onSetFormat && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger disabled={isFinished}>
                        Formato desta partida
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => onSetFormat(match, null)}>
                          {!match.match_format ? "✓ " : "   "}Padrão da chave
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onSetFormat(match, "single_set")}>
                          {match.match_format === "single_set" ? "✓ " : "   "}Set único
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onSetFormat(match, "best_of_3_tiebreak")}>
                          {match.match_format === "best_of_3_tiebreak" ? "✓ " : "   "}Melhor de 3 (com tiebreak)
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
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
