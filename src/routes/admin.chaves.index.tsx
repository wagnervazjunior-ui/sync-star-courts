import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Trash2 } from "lucide-react";
import { listBrackets, deleteBracket } from "@/lib/brackets.functions";
import { CreateBracketDialog } from "@/components/brackets/CreateBracketDialog";
import { SimulateBracketDialog } from "@/components/brackets/SimulateBracketDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/chaves/")({
  component: ChavesIndex,
});

function ChavesIndex() {
  const [search, setSearch] = useState("");
  const callList = useServerFn(listBrackets);
  const callDelete = useServerFn(deleteBracket);
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["brackets-list", search],
    queryFn: () => callList({ data: { search: search || undefined } }),
  });

  const handleDeleteSimulation = async (e: React.MouseEvent, bracketId: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Apagar simulação "${name}"?`)) return;
    try {
      await callDelete({ data: { id: bracketId } });
      toast.success("Simulação apagada");
      qc.invalidateQueries({ queryKey: ["brackets-list"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao apagar");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Chaves</h1>
          <p className="text-sm text-muted-foreground">Gere e gerencie chaves de eliminação dupla.</p>
        </div>
        <div className="flex gap-2">
          <SimulateBracketDialog onCreated={refetch} />
          <CreateBracketDialog onCreated={refetch} />
        </div>
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
      ) : error ? (
        <Card className="p-8 text-center space-y-3">
          <p className="text-sm text-destructive">Erro ao carregar chaves: {(error as any)?.message ?? "erro desconhecido"}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar de novo</Button>
        </Card>
      ) : !data?.brackets.length ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhuma chave criada ainda.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.brackets.map((b: any) => {
            const ch = data.championships.find((c: any) => c.id === b.championship_id);
            const cat = data.categories.find((c: any) => c.id === b.category_id);
            const isSimulation = b.name?.startsWith("Simulação");
            return (
              <Link key={b.id} to="/admin/chaves/$bracketId" params={{ bracketId: b.id }} className="block">
                <Card className="p-4 hover:border-primary/60 transition">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold truncate">{b.name}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant={b.status === "finished" ? "default" : "secondary"}>
                        {b.status === "finished" ? "Final" : "Live"}
                      </Badge>
                      {isSimulation && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleDeleteSimulation(e, b.id, b.name)}
                          title="Apagar simulação"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{ch?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{cat?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {b.match_format === "best_of_3_tiebreak" ? "Melhor de 3" : "Set único"}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
