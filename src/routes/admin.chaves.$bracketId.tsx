import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { getBracket, deleteBracket } from "@/lib/brackets.functions";
import { BracketView } from "@/components/brackets/BracketView";
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

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">Duplas (seeds)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {teams.map((t) => (
            <div
              key={t.id}
              className="text-xs rounded border border-border/60 bg-background/40 px-2 py-1.5 flex items-center gap-2"
            >
              <Badge variant="outline" className="shrink-0">
                #{t.seed}
              </Badge>
              <span className="truncate">
                {t.team_name || `${t.athlete1_name} / ${t.athlete2_name}`}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <BracketView
        matches={matches}
        teams={teams}
        format={data.bracket.match_format as any}
        onRefresh={refetch}
      />
    </div>
  );
}
