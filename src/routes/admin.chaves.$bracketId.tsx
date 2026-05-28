import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getBracket, deleteBracket } from "@/lib/brackets.functions";
import { BracketView } from "@/components/brackets/BracketView";
import { StandingsTab } from "@/components/brackets/StandingsTab";
import type { MatchCardData, TeamRef } from "@/components/brackets/MatchCard";

export const Route = createFileRoute("/admin/chaves/$bracketId")({
  component: BracketDetail,
});

function BracketDetail() {
  const { bracketId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const callGet = useServerFn(getBracket);
  const callDelete = useServerFn(deleteBracket);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["bracket", bracketId],
    queryFn: () => callGet({ data: { id: bracketId } }),
  });

  const [deleting, setDeleting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }
  if (!data) return <p className="text-muted-foreground">Chave não encontrada.</p>;

  const teams: TeamRef[] = (data.teams ?? []) as any;
  const matches: MatchCardData[] = (data.matches ?? []) as any;

  const handleDelete = async () => {
    if (!confirm("Excluir esta chave? Esta ação não pode ser desfeita.")) return;
    setDeleting(true);
    try {
      await callDelete({ data: { id: bracketId } });
      toast.success("Chave excluída");
      qc.invalidateQueries({ queryKey: ["brackets-list"] });
      navigate({ to: "/admin/chaves" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/chaves">
          <ArrowLeft className="size-4" /> Chaves
        </Link>
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data.bracket.name}</h1>
          <p className="text-sm text-muted-foreground">
            {data.championship?.name} · {data.category?.name} · {teams.length} duplas ·{" "}
            <Badge variant={data.bracket.status === "finished" ? "default" : "secondary"}>
              {data.bracket.status === "finished" ? "Finalizada" : "Em andamento"}
            </Badge>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting}>
          <Trash2 className="size-4" /> Excluir
        </Button>
      </div>

      <Tabs defaultValue="initial" className="space-y-4">
        <TabsList>
          <TabsTrigger value="initial">Fase Inicial</TabsTrigger>
          <TabsTrigger value="final">Fase Final</TabsTrigger>
          <TabsTrigger value="standings">Classificação</TabsTrigger>
        </TabsList>
        <TabsContent value="initial">
          <BracketView
            matches={matches}
            teams={teams}
            format={data.bracket.match_format as any}
            phase="initial"
            onRefresh={refetch}
          />
        </TabsContent>
        <TabsContent value="final">
          <BracketView
            matches={matches}
            teams={teams}
            format={data.bracket.match_format as any}
            phase="final"
            onRefresh={refetch}
          />
        </TabsContent>
        <TabsContent value="standings">
          <StandingsTab teams={teams} matches={matches} onSaved={refetch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
