import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listCategoriesForBracket, createBracket, listAccessibleChampionships } from "@/lib/brackets.functions";

export function CreateBracketDialog({
  onCreated,
  defaultChampionshipId,
  trigger,
}: {
  onCreated?: () => void;
  defaultChampionshipId?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [championshipId, setChampionshipId] = useState(defaultChampionshipId ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [matchFormat, setMatchFormat] = useState<"single_set" | "best_of_3_tiebreak">("single_set");
  const [targetScore, setTargetScore] = useState(18);
  const [tiebreak, setTiebreak] = useState(15);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const callCreate = useServerFn(createBracket);
  const callCats = useServerFn(listCategoriesForBracket);
  const callChamps = useServerFn(listAccessibleChampionships);

  const { data: champsData } = useQuery({
    queryKey: ["my-championships"],
    queryFn: () => callChamps(),
    enabled: open && !defaultChampionshipId,
  });

  const { data: catsData } = useQuery({
    queryKey: ["cats-for-bracket", championshipId],
    queryFn: () => callCats({ data: { championship_id: championshipId } }),
    enabled: open && !!championshipId,
  });

  const handleCreate = async () => {
    if (!championshipId || !categoryId || !name) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSaving(true);
    try {
      const res = await callCreate({
        data: {
          championship_id: championshipId,
          category_id: categoryId,
          name,
          match_format: matchFormat,
          target_score: targetScore,
          tiebreak_points: tiebreak,
        },
      });
      toast.success("Chave gerada");
      setOpen(false);
      onCreated?.();
      navigate({ to: "/admin/chaves/$bracketId", params: { bracketId: res.bracket_id } });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar chave");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" /> Nova chave
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar nova chave</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!defaultChampionshipId && (
            <div>
              <Label>Campeonato</Label>
              <Select value={championshipId} onValueChange={setChampionshipId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(champsData?.championships ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={!championshipId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(catsData?.categories ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.confirmed_count} duplas confirmadas
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nome da chave</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Masculino A — Etapa 1" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3">
              <Label>Formato</Label>
              <Select value={matchFormat} onValueChange={(v) => setMatchFormat(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_set">Set único</SelectItem>
                  <SelectItem value="best_of_3_tiebreak">Melhor de 3 (com tiebreak)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pontos / set</Label>
              <Input
                type="number"
                value={targetScore}
                onChange={(e) => setTargetScore(parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div>
              <Label>Tiebreak</Label>
              <Input
                type="number"
                value={tiebreak}
                onChange={(e) => setTiebreak(parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Duplas vêm das inscrições <strong>confirmadas</strong> da categoria, ordenadas por data de inscrição
            (seeding por inscrição).
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} Gerar chave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
