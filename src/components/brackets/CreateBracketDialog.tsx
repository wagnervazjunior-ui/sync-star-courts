import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listCategoriesForBracket, createBracket, listAccessibleChampionships } from "@/lib/brackets.functions";

const NEW_CATEGORY = "__new__";

function parsePastedTeams(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+e\s+/i);
      return {
        team_name: line,
        athlete1_name: parts[0] ?? line,
        athlete2_name: parts[1] ?? "",
      };
    });
}

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
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryGender, setNewCategoryGender] = useState<"male" | "female" | "mixed">("mixed");
  const [teamSource, setTeamSource] = useState<"registrations" | "pasted">("registrations");
  const [pastedNames, setPastedNames] = useState("");
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

  const isNewCategory = categoryId === NEW_CATEGORY;
  const usesPasted = isNewCategory || teamSource === "pasted";
  const pastedTeams = parsePastedTeams(pastedNames);

  const handleCreate = async () => {
    if (!championshipId || !categoryId || !name) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (isNewCategory && !newCategoryName.trim()) {
      toast.error("Informe o nome da categoria avulsa");
      return;
    }
    if (usesPasted && pastedTeams.length < 3) {
      toast.error("Cole pelo menos 3 duplas (uma por linha)");
      return;
    }
    setSaving(true);
    try {
      let actualCategoryId = categoryId;
      if (isNewCategory) {
        const { data: newCat, error: catErr } = await supabase
          .from("categories")
          .insert({
            championship_id: championshipId,
            name: newCategoryName.trim(),
            gender: newCategoryGender,
            max_slots: pastedTeams.length,
            price_cents: 0,
            visible: false,
          } as any)
          .select("id")
          .single();
        if (catErr) throw new Error(catErr.message);
        actualCategoryId = (newCat as any).id;
      }

      const res = await callCreate({
        data: {
          championship_id: championshipId,
          category_id: actualCategoryId,
          name,
          match_format: matchFormat,
          target_score: targetScore,
          tiebreak_points: tiebreak,
          ...(usesPasted ? { manual_teams: pastedTeams } : {}),
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
            <Select
              value={categoryId}
              onValueChange={(v) => { setCategoryId(v); if (v === NEW_CATEGORY) setTeamSource("pasted"); }}
              disabled={!championshipId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(catsData?.categories ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.confirmed_count} duplas confirmadas
                  </SelectItem>
                ))}
                <SelectItem value={NEW_CATEGORY}>+ Categoria avulsa (não cadastrada no site)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Use "categoria avulsa" para chaves como Profissional, cujas inscrições não passam pelo site — a
              categoria é criada oculta (não aparece na página pública) só pra organizar a chave.
            </p>
          </div>
          {isNewCategory && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Nome da categoria</Label>
                <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="ex: Profissional" />
              </div>
              <div>
                <Label>Gênero</Label>
                <Select value={newCategoryGender} onValueChange={(v) => setNewCategoryGender(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Masculina</SelectItem>
                    <SelectItem value="female">Feminina</SelectItem>
                    <SelectItem value="mixed">Mista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div>
            <Label>Nome da chave</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Masculino A — Etapa 1" />
          </div>
          <div>
            <Label>Duplas</Label>
            {!isNewCategory && (
              <div className="flex gap-1 rounded-lg border border-border/50 p-1 mb-2">
                <button
                  type="button"
                  onClick={() => setTeamSource("registrations")}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${teamSource === "registrations" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Inscrições confirmadas
                </button>
                <button
                  type="button"
                  onClick={() => setTeamSource("pasted")}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${teamSource === "pasted" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Colar lista
                </button>
              </div>
            )}
            {usesPasted ? (
              <>
                <Textarea
                  rows={8}
                  placeholder={"Kuka e Torres\nKairo e Gabriel\nLaurent e Caio Ramirez\n..."}
                  value={pastedNames}
                  onChange={(e) => setPastedNames(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {pastedTeams.length} dupla{pastedTeams.length === 1 ? "" : "s"} reconhecida{pastedTeams.length === 1 ? "" : "s"}, uma por linha.
                  Se a linha tiver " e " no meio, separa os dois nomes; senão a linha vira o nome da dupla inteira.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Duplas vêm das inscrições <strong>confirmadas</strong> da categoria, ordenadas por data de inscrição
                (seeding por inscrição).
              </p>
            )}
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
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={saving || (usesPasted && pastedTeams.length < 3) || (isNewCategory && !newCategoryName.trim())}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} Gerar chave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
