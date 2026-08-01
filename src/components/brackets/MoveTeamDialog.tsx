import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { swapMatchSlots } from "@/lib/brackets.functions";
import type { MatchCardData, TeamRef } from "./MatchCard";
import { labelTeam } from "./MatchCard";

const PHASE_LABEL: Record<string, string> = {
  WB: "Vencedores",
  LB: "Perdedores",
  SEMI: "Semifinal",
  FINAL: "Final",
  THIRD: "3º lugar",
};

function matchLabel(m: MatchCardData) {
  return `${PHASE_LABEL[m.phase] ?? m.phase} · Rodada ${m.round} · Confronto #${m.position}`;
}

export function MoveTeamDialog({
  open,
  onClose,
  sourceMatch,
  sourceSlot,
  allMatches,
  teams,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  sourceMatch: MatchCardData | null;
  sourceSlot: "a" | "b";
  allMatches: MatchCardData[];
  teams: TeamRef[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const callSwap = useServerFn(swapMatchSlots);

  const sourceTeamId = sourceMatch
    ? sourceSlot === "a"
      ? sourceMatch.team_a_id
      : sourceMatch.team_b_id
    : null;
  const sourceTeam = teams.find((t) => t.id === sourceTeamId);

  const candidates = useMemo(() => {
    if (!sourceMatch) return [];
    const out: Array<{ value: string; teamLabel: string; matchLabel: string; opponentLabel: string }> = [];
    for (const m of allMatches) {
      if (m.phase !== sourceMatch.phase) continue;
      if (m.winner_team_id) continue;
      (["a", "b"] as const).forEach((slot) => {
        if (m.id === sourceMatch.id && slot === sourceSlot) return;
        // SEMI: all slots are movable (admin arranges the 4 semi-finalists manually).
        // Other phases: only slots seeded initially (not propagated) can be moved.
        if (m.phase !== "SEMI") {
          const src = slot === "a" ? m.source_a : m.source_b;
          if (src && src.type !== "seed" && src.type !== "bye") return;
        }
        const teamId = slot === "a" ? m.team_a_id : m.team_b_id;
        const opponentId = slot === "a" ? m.team_b_id : m.team_a_id;
        const team = teams.find((t) => t.id === teamId);
        const opponent = teams.find((t) => t.id === opponentId);
        out.push({
          value: `${m.id}:${slot}`,
          teamLabel: team ? labelTeam(team) : "(vaga vazia)",
          matchLabel: matchLabel(m),
          opponentLabel: opponent ? `vs ${labelTeam(opponent)}` : "",
        });
      });
    }
    // Vagas vazias primeiro é confuso — duplas de verdade primeiro, ordenadas por nome.
    return out.sort((a, b) => a.teamLabel.localeCompare(b.teamLabel, "pt-BR"));
  }, [allMatches, sourceMatch, sourceSlot, teams]);

  const handlePick = async (targetKey: string) => {
    if (!sourceMatch) return;
    const [matchId, slot] = targetKey.split(":");
    setSaving(targetKey);
    try {
      await callSwap({
        data: {
          match_a_id: sourceMatch.id,
          slot_a: sourceSlot,
          match_b_id: matchId,
          slot_b: slot as "a" | "b",
        },
      });
      toast.success("Duplas trocadas");
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e.message ?? "Erro";
      toast.error(
        msg === "SLOT_FROM_PROPAGATION"
          ? "Slot vem de propagação automática — não pode ser movido."
          : msg === "MATCH_ALREADY_PLAYED"
          ? "Partida já tem resultado."
          : msg,
      );
    } finally {
      setSaving(null);
    }
  };

  if (!sourceMatch) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="size-4 text-primary" />
            Trocar dupla
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{sourceTeam ? labelTeam(sourceTeam) : "(vaga vazia)"}</strong>{" "}
            está em <strong className="text-foreground">{matchLabel(sourceMatch)}</strong>. Escolha com quem trocar:
          </p>
        </DialogHeader>
        <Command className="rounded-none border-t">
          <CommandInput placeholder="Buscar dupla pelo nome…" />
          <CommandList className="max-h-80">
            <CommandEmpty>Nenhuma dupla elegível encontrada.</CommandEmpty>
            <CommandGroup>
              {candidates.map((c) => (
                <CommandItem
                  key={c.value}
                  value={`${c.teamLabel} ${c.matchLabel}`}
                  disabled={saving !== null}
                  onSelect={() => handlePick(c.value)}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.teamLabel}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.matchLabel}
                      {c.opponentLabel ? ` · ${c.opponentLabel}` : ""}
                    </p>
                  </div>
                  {saving === c.value && (
                    <span className="text-xs text-muted-foreground shrink-0">trocando…</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <p className="px-4 py-3 text-xs text-muted-foreground border-t">
          Só é possível trocar entre confrontos da mesma fase, sem resultado lançado e cujas vagas venham do seed
          inicial (não de vencedor/perdedor de outra partida).
        </p>
      </DialogContent>
    </Dialog>
  );
}
