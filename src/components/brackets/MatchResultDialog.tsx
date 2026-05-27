import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { recordMatchResult, resetMatch } from "@/lib/brackets.functions";
import type { MatchCardData, TeamRef } from "./MatchCard";
import { labelTeam } from "./MatchCard";

export function MatchResultDialog({
  open,
  onClose,
  match,
  teams,
  format,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  match: MatchCardData | null;
  teams: TeamRef[];
  format: "single_set" | "best_of_3_tiebreak";
  onSaved: () => void;
}) {
  const numSets = format === "single_set" ? 1 : 3;
  const [sets, setSets] = useState<Array<{ a: string; b: string }>>(() =>
    Array.from({ length: numSets }, () => ({ a: "", b: "" })),
  );
  const [saving, setSaving] = useState(false);
  const callRecord = useServerFn(recordMatchResult);
  const callReset = useServerFn(resetMatch);

  if (!match) return null;
  const teamA = teams.find((t) => t.id === match.team_a_id);
  const teamB = teams.find((t) => t.id === match.team_b_id);

  const handleSave = async () => {
    const parsed = sets
      .map((s) => ({ a: parseInt(s.a, 10), b: parseInt(s.b, 10) }))
      .filter((s) => !isNaN(s.a) && !isNaN(s.b));
    if (!parsed.length) return toast.error("Informe ao menos um set");
    setSaving(true);
    try {
      await callRecord({ data: { match_id: match.id, sets: parsed } });
      toast.success("Resultado salvo");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Resetar este jogo? O avanço já registrado pode ficar inconsistente.")) return;
    setSaving(true);
    try {
      await callReset({ data: { match_id: match.id } });
      toast.success("Jogo resetado");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {match.phase} · Rodada {match.round} · Jogo #{match.position}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto_auto_1fr] items-center gap-2">
            <div className="text-sm font-medium truncate">{teamA ? labelTeam(teamA) : "—"}</div>
            <div className="text-xs text-muted-foreground">×</div>
            <div />
            <div className="text-sm font-medium truncate text-right">{teamB ? labelTeam(teamB) : "—"}</div>
          </div>
          {sets.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <div>
                <Label className="text-xs">Set {i + 1} — A</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={s.a}
                  onChange={(e) => setSets((prev) => prev.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
                />
              </div>
              <span className="pb-2 text-muted-foreground">×</span>
              <div>
                <Label className="text-xs">Set {i + 1} — B</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={s.b}
                  onChange={(e) => setSets((prev) => prev.map((x, j) => (j === i ? { ...x, b: e.target.value } : x)))}
                />
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2">
          {match.winner_team_id && (
            <Button variant="ghost" onClick={handleReset} disabled={saving}>
              Resetar
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !teamA || !teamB}>
            Salvar resultado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
