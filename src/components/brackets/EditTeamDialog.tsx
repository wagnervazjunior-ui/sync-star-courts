import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { updateTeam } from "@/lib/brackets.functions";
import type { TeamRef } from "./MatchCard";

export function EditTeamDialog({
  open,
  onClose,
  team,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  team: TeamRef | null;
  onSaved: () => void;
}) {
  const [teamName, setTeamName] = useState("");
  const [a1, setA1] = useState("");
  const [a2, setA2] = useState("");
  const [saving, setSaving] = useState(false);
  const callUpdate = useServerFn(updateTeam);

  useEffect(() => {
    if (team) {
      setTeamName(team.team_name ?? "");
      setA1(team.athlete1_name ?? "");
      setA2(team.athlete2_name ?? "");
    }
  }, [team]);

  if (!team) return null;

  const handleSave = async () => {
    if (!a1.trim() || !a2.trim()) return toast.error("Informe os dois atletas");
    setSaving(true);
    try {
      await callUpdate({
        data: { team_id: team.id, team_name: teamName, athlete1_name: a1, athlete2_name: a2 },
      });
      toast.success("Dupla atualizada");
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
          <DialogTitle>Editar dupla · seed #{team.seed}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome da dupla (opcional)</Label>
            <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} />
          </div>
          <div>
            <Label>Atleta 1</Label>
            <Input value={a1} onChange={(e) => setA1(e.target.value)} />
          </div>
          <div>
            <Label>Atleta 2</Label>
            <Input value={a2} onChange={(e) => setA2(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
