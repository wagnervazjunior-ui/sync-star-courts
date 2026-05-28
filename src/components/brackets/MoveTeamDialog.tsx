import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { swapMatchSlots } from "@/lib/brackets.functions";
import type { MatchCardData, TeamRef } from "./MatchCard";
import { labelTeam } from "./MatchCard";

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
  const [target, setTarget] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const callSwap = useServerFn(swapMatchSlots);

  const sourceTeamId = sourceMatch
    ? sourceSlot === "a"
      ? sourceMatch.team_a_id
      : sourceMatch.team_b_id
    : null;
  const sourceTeam = teams.find((t) => t.id === sourceTeamId);

  const candidates = useMemo(() => {
    if (!sourceMatch) return [];
    const out: Array<{ value: string; label: string }> = [];
    for (const m of allMatches) {
      if (m.phase !== sourceMatch.phase) continue;
      if (m.winner_team_id) continue;
      (["a", "b"] as const).forEach((slot) => {
        if (m.id === sourceMatch.id && slot === sourceSlot) return;
        const src = slot === "a" ? m.source_a : m.source_b;
        if (src && src.type !== "seed" && src.type !== "bye") return;
        const teamId = slot === "a" ? m.team_a_id : m.team_b_id;
        const team = teams.find((t) => t.id === teamId);
        const teamLabel = team ? labelTeam(team) : "(vazio)";
        out.push({
          value: `${m.id}:${slot}`,
          label: `${m.phase} R${m.round} #${m.position} · ${slot.toUpperCase()} — ${teamLabel}`,
        });
      });
    }
    return out;
  }, [allMatches, sourceMatch, sourceSlot, teams]);

  const handleSave = async () => {
    if (!sourceMatch || !target) return;
    const [matchId, slot] = target.split(":");
    setSaving(true);
    try {
      await callSwap({
        data: {
          match_a_id: sourceMatch.id,
          slot_a: sourceSlot,
          match_b_id: matchId,
          slot_b: slot as "a" | "b",
        },
      });
      toast.success("Duplas movidas");
      onSaved();
      onClose();
      setTarget("");
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
      setSaving(false);
    }
  };

  if (!sourceMatch) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover dupla</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            Movendo <strong>{sourceTeam ? labelTeam(sourceTeam) : "(vazio)"}</strong> de{" "}
            <strong>
              {sourceMatch.phase} R{sourceMatch.round} #{sourceMatch.position} · {sourceSlot.toUpperCase()}
            </strong>
          </p>
          <div>
            <Label>Partida destino</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {candidates.length === 0 && (
                  <div className="p-2 text-xs text-muted-foreground">Nenhuma partida elegível.</div>
                )}
                {candidates.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Só é possível mover entre partidas da mesma fase, sem resultado lançado e cujos slots venham do seed inicial
            (não da propagação automática).
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !target}>
            Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
