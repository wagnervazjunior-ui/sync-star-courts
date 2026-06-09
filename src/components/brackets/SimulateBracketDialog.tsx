import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listCategoriesForBracket, createBracket, listAccessibleChampionships } from "@/lib/brackets.functions";

export function SimulateBracketDialog({
  defaultChampionshipId,
  onCreated,
}: {
  defaultChampionshipId?: string;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [championshipId, setChampionshipId] = useState(defaultChampionshipId ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [numTeams, setNumTeams] = useState("8");
  const [matchFormat, setMatchFormat] = useState<"single_set" | "best_of_3_tiebreak">("single_set");
  const [targetScore, setTargetScore] = useState(18);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const callCreate = useServerFn(createBracket);
  const callCats = useServerFn(listCategoriesForBracket);
  const callChamps = useServerFn(listAccessibleChampionships);

  const today = new Date().toLocaleDateString("pt-BR");

  const { data: champsData } = useQuery({
    queryKey: ["my-championships-sim"],
    queryFn: () => callChamps(),
    enabled: open && !defaultChampionshipId,
  });

  const { data: catsData } = useQuery({
    queryKey: ["cats-for-bracket-sim", championshipId],
    queryFn: () => callCats({ data: { championship_id: championshipId } }),
    enabled: open && !!championshipId,
  });

  const numTeamsInt = Math.max(3, Math.min(256, parseInt(numTeams, 10) || 3));

  const handleCreate = async () => {
    if (!championshipId) { toast.error("Selecione o campeonato"); return; }
    if (!categoryId) { toast.error("Selecione a categoria"); return; }
    setSaving(true);
    try {
      // Gerar duplas fictícias
      const manual_teams = Array.from({ length: numTeamsInt }, (_, i) => ({
        team_name: `Dupla ${i + 1}`,
        athlete1_name: `Atleta A${i + 1}`,
        athlete2_name: `Atleta B${i + 1}`,
      }));

      const res = await callCreate({
        data: {
          championship_id: championshipId,
          category_id: categoryId,
          name: `Simulação ${numTeamsInt} duplas — ${today}`,
          match_format: matchFormat,
          target_score: targetScore,
          tiebreak_points: 15,
          manual_teams,
        },
      });

      toast.success(`Simulação criada com ${numTeamsInt} duplas`);
      setOpen(false);
      onCreated?.();
      navigate({ to: "/admin/chaves/$bracketId", params: { bracketId: res.bracket_id } });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar simulação");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FlaskConical className="size-4" /> Simular chave
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="size-5 text-primary" /> Simular chave
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-1">
          Gera uma chave de teste com duplas fictícias (Dupla 1, Dupla 2…). Útil para testar o formato e o fluxo antes do campeonato real.
        </p>

        <div className="space-y-4">
          {!defaultChampionshipId && (
            <div className="space-y-1.5">
              <Label>Campeonato</Label>
              <Select value={championshipId} onValueChange={setChampionshipId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(champsData?.championships ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={!championshipId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(catsData?.categories ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Número de duplas</Label>
            <Input
              type="number"
              min={3}
              max={256}
              value={numTeams}
              onChange={(e) => setNumTeams(e.target.value)}
              onBlur={() => setNumTeams(String(numTeamsInt))}
            />
            <p className="text-xs text-muted-foreground">
              Serão criadas: Dupla 1, Dupla 2, … Dupla {numTeamsInt}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Formato</Label>
              <Select value={matchFormat} onValueChange={(v) => setMatchFormat(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_set">Set único</SelectItem>
                  <SelectItem value="best_of_3_tiebreak">Melhor de 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pontos / set</Label>
              <Input
                type="number"
                value={targetScore}
                min={1}
                max={99}
                onChange={(e) => setTargetScore(parseInt(e.target.value, 10) || 18)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="hero" onClick={handleCreate} disabled={saving || !championshipId || !categoryId}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <FlaskConical className="size-4 mr-2" />}
            Gerar simulação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
