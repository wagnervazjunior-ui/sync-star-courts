import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicBracket } from "@/lib/brackets.functions";
import { PublicHeader } from "@/components/PublicHeader";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BracketView } from "@/components/brackets/BracketView";
import { StandingsTab } from "@/components/brackets/StandingsTab";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MatchCardData, TeamRef } from "@/components/brackets/MatchCard";

export const Route = createFileRoute("/chaves/$bracketId")({
  head: () => ({ meta: [{ title: "Chave — Open Sync" }] }),
  component: PublicBracketPage,
});

function PublicBracketPage() {
  const { bracketId } = Route.useParams();
  const callGet = useServerFn(getPublicBracket);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-bracket", bracketId],
    queryFn: () => callGet({ data: { id: bracketId } }),
    retry: false,
    refetchInterval: 30_000, // auto-refresh a cada 30s
  });

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="text-muted-foreground">Esta chave não está disponível publicamente.</p>
          <Button asChild variant="ghost" className="mt-4">
            <Link to="/tabelas"><ArrowLeft className="size-4" /> Ver tabelas</Link>
          </Button>
        </main>
      </div>
    );
  }

  const teams = data.teams as TeamRef[];
  const matches = data.matches as unknown as MatchCardData[];
  const format = data.bracket.match_format as "single_set" | "best_of_3_tiebreak";

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 pb-24 md:pb-8">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/tabelas"><ArrowLeft className="size-4" /> Tabelas</Link>
        </Button>

        <div className="mb-6">
          <p className="text-sm text-muted-foreground">{data.championship?.name}</p>
          <h1 className="text-3xl font-bold">{data.bracket.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {data.category?.name && <Badge variant="outline">{data.category.name}</Badge>}
            <Badge variant={data.bracket.status === "finished" ? "default" : "secondary"}>
              {data.bracket.status === "finished" ? "Finalizada" : "Em andamento"}
            </Badge>
            <span className="text-xs text-muted-foreground">{teams.length} duplas · atualiza automaticamente</span>
          </div>
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
              format={format}
              phase="initial"
              onRefresh={() => {}}
              readonly
            />
          </TabsContent>
          <TabsContent value="final">
            <BracketView
              matches={matches}
              teams={teams}
              format={format}
              phase="final"
              onRefresh={() => {}}
              readonly
            />
          </TabsContent>
          <TabsContent value="standings">
            <StandingsTab teams={teams} matches={matches} onSaved={() => {}} readonly />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
