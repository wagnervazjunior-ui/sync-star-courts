import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listBrackets, listCategoriesForBracket, createBracket } from "@/lib/brackets.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/chaves/")({
  component: ChavesIndex,
});

function ChavesIndex() {
  const [search, setSearch] = useState("");
  const callList = useServerFn(listBrackets);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["brackets-list", search],
    queryFn: () => callList({ data: { search: search || undefined } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Chaves</h1>
          <p className="text-sm text-muted-foreground">Gere e gerencie chaves de eliminação dupla.</p>
        </div>
        <CreateBracketDialog onCreated={refetch} />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome, campeonato ou categoria…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : !data?.brackets.length ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhuma chave criada ainda.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.brackets.map((b: any) => {
            const ch = data.championships.find((c: any) => c.id === b.championship_id);
            const cat = data.categories.find((c: any) => c.id === b.category_id);
            return (
              <Link
                key={b.id}
                to="/admin/chaves/$bracketId"
                params={{ bracketId: b.id }}
                className="block"
              >
                <Card className="p-4 hover:border-primary/60 transition">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold truncate">{b.name}</h3>
                    <Badge variant={b.status === "finished" ? "default" : "secondary"}>
                      {b.status === "finished" ? "Final" : "Live"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{ch?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{cat?.name ?? "—"}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateBracketDialog({
  onCreated,
  defaultChampionshipId,
  trigger,
}: {
  onCreated: () => void;
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

  const { data: champs } = useQuery({
    queryKey: ["my-championships"],
    queryFn: async () => {
      const { data } = await supabase.rpc("list_manageable_championships");
      return data ?? [];
    },
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
      onCreated();
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
                  {(champs ?? []).map((c: any) => (
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
            Duplas são pegas das inscrições <strong>confirmadas</strong> da categoria, ordenadas por data de inscrição
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

export { CreateBracketDialog };
