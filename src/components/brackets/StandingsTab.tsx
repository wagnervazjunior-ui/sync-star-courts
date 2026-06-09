import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Pencil } from "lucide-react";
import type { MatchCardData, TeamRef } from "./MatchCard";
import { labelTeam } from "./MatchCard";
import { EditTeamDialog } from "./EditTeamDialog";

interface Row {
  team: TeamRef;
  wins: number;
  losses: number;
  status: "ativa" | "eliminada" | "campea" | "vice" | "terceira" | "quarta";
}

function statusLabel(s: Row["status"]) {
  switch (s) {
    case "campea":
      return { label: "Campeã", className: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" };
    case "vice":
      return { label: "Vice", className: "bg-slate-400/15 text-slate-500 border-slate-400/30" };
    case "terceira":
      return { label: "3º lugar", className: "bg-amber-700/15 text-amber-700 border-amber-700/30" };
    case "quarta":
      return { label: "4º lugar", className: "bg-muted text-muted-foreground" };
    case "eliminada":
      return { label: "Eliminada", className: "bg-destructive/10 text-destructive border-destructive/30" };
    default:
      return { label: "Ativa", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" };
  }
}

export function StandingsTab({
  teams,
  matches,
  onSaved,
  readonly = false,
}: {
  teams: TeamRef[];
  matches: MatchCardData[];
  onSaved: () => void;
  readonly?: boolean;
}) {
  const [editing, setEditing] = useState<TeamRef | null>(null);

  const rows = useMemo<Row[]>(() => {
    return teams
      .map((team) => {
        let wins = 0;
        let losses = 0;
        for (const m of matches) {
          if (!m.winner_team_id) continue;
          if (m.team_a_id !== team.id && m.team_b_id !== team.id) continue;
          if (m.winner_team_id === team.id) wins++;
          else losses++;
        }
        let status: Row["status"] = "ativa";
        const rank = (team as any).final_rank;
        if (rank === 1) status = "campea";
        else if (rank === 2) status = "vice";
        else if (rank === 3) status = "terceira";
        else if (rank === 4) status = "quarta";
        else if (losses >= 2) status = "eliminada";
        return { team, wins, losses, status } as Row;
      })
      .sort((a, b) => {
        const rankA = (a.team as any).final_rank ?? 99;
        const rankB = (b.team as any).final_rank ?? 99;
        if (rankA !== rankB) return rankA - rankB;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (a.losses !== b.losses) return a.losses - b.losses;
        return a.team.seed - b.team.seed;
      });
  }, [teams, matches]);

  const podium = rows.filter((r) => ["campea", "vice", "terceira"].includes(r.status));

  return (
    <div className="space-y-4">
      {podium.length === 3 && (
        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Trophy className="size-4 text-yellow-500" /> Pódio
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {podium.map((r) => {
              const s = statusLabel(r.status);
              return (
                <div key={r.team.id} className={`rounded-md border px-3 py-2 ${s.className}`}>
                  <div className="text-[10px] uppercase tracking-wider opacity-80">{s.label}</div>
                  <div className="font-semibold truncate">{labelTeam(r.team)}</div>
                  <div className="text-xs opacity-80">Seed #{r.team.seed}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-[40px_40px_1fr_60px_60px_120px_40px] gap-1 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
          <div>Pos</div>
          <div>Seed</div>
          <div>Dupla</div>
          <div className="text-right">V</div>
          <div className="text-right">D</div>
          <div>Status</div>
          <div />
        </div>
        {rows.map((r, idx) => {
          const s = statusLabel(r.status);
          return (
            <div
              key={r.team.id}
              className="grid grid-cols-[40px_40px_1fr_60px_60px_120px_40px] gap-1 px-3 py-2 text-sm border-b border-border/40 last:border-b-0 items-center"
            >
              <div className="text-muted-foreground tabular-nums">{idx + 1}º</div>
              <div className="text-muted-foreground tabular-nums">#{r.team.seed}</div>
              <div className="truncate">
                <div className="font-medium truncate">{labelTeam(r.team)}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.team.athlete1_name} / {r.team.athlete2_name}
                </div>
              </div>
              <div className="text-right tabular-nums">{r.wins}</div>
              <div className="text-right tabular-nums">{r.losses}</div>
              <div>
                <Badge variant="outline" className={s.className}>
                  {s.label}
                </Badge>
              </div>
              <div>
                {!readonly && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => setEditing(r.team)}
                    aria-label="Editar dupla"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      <p className="text-xs text-muted-foreground">
        Para preservar o histórico das partidas já jogadas, só é permitido editar os nomes da dupla.
        Para mudar posições no chaveamento, use o menu "⋯" de cada partida na aba Fase Inicial.
      </p>

      <EditTeamDialog open={!!editing} onClose={() => setEditing(null)} team={editing} onSaved={onSaved} />
    </div>
  );
}
