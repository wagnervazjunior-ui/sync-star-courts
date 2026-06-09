import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Network, Search, Trophy, ChevronRight } from "lucide-react";
import { listPublicBrackets } from "@/lib/brackets.functions";
import { useServerFn as useSFn } from "@tanstack/react-start";

export const Route = createFileRoute("/tabelas")({
  head: () => ({
    meta: [
      { title: "Tabelas — Open Sync" },
      { name: "description", content: "Acompanhe as chaves e classificações dos campeonatos." },
    ],
  }),
  component: TabelasPage,
});

function TabelasPage() {
  const [search, setSearch] = useState("");

  // 1. Buscar campeonatos ativos com chaves públicas
  const { data: championships, isLoading } = useQuery({
    queryKey: ["tabelas-championships"],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 5);
      const cutoffDate = cutoff.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("championships")
        .select("id, name, slug, start_date, end_date")
        .eq("active", true)
        .or(`end_date.is.null,end_date.gte.${cutoffDate}`)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!championships) return [];
    const q = search.trim().toLowerCase();
    if (!q) return championships;
    return championships.filter((c) => c.name.toLowerCase().includes(q));
  }, [championships, search]);

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 pb-28 md:pb-12">
        <div className="flex items-center gap-3 mb-2">
          <Network className="size-6 text-primary" />
          <h1 className="text-3xl font-bold">Tabelas</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Acompanhe as chaves e classificações de cada campeonato.
        </p>

        {/* Busca */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar campeonato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-16">
            {search ? `Nenhum campeonato encontrado para "${search}".` : "Nenhuma tabela disponível no momento."}
          </p>
        )}

        <div className="space-y-4">
          {filtered.map((ch) => (
            <ChampionshipBracketsCard key={ch.id} championship={ch} />
          ))}
        </div>
      </main>
    </div>
  );
}

function ChampionshipBracketsCard({ championship }: { championship: any }) {
  const callList = useSFn(listPublicBrackets);

  const { data, isLoading } = useQuery({
    queryKey: ["public-brackets", championship.id],
    queryFn: () => callList({ data: { championship_id: championship.id } }),
  });

  const brackets = data?.brackets ?? [];

  // Não renderiza se não houver chaves públicas
  if (!isLoading && brackets.length === 0) return null;

  return (
    <Card className="p-5 bg-gradient-card border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="size-4 text-primary" />
        <h2 className="font-bold">{championship.name}</h2>
        {championship.start_date && (
          <span className="text-xs text-muted-foreground ml-auto">
            {new Date(championship.start_date).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : (
        <div className="space-y-2">
          {brackets.map((b: any) => (
            <Link
              key={b.id}
              to="/chaves/$bracketId"
              params={{ bracketId: b.id }}
              className="flex items-center justify-between rounded-lg border border-border/40 px-4 py-2.5 hover:border-primary/50 hover:bg-accent/30 transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Network className="size-4 text-primary shrink-0" />
                <span className="font-medium text-sm truncate">{b.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={b.status === "finished" ? "default" : "secondary"} className="text-xs">
                  {b.status === "finished" ? "Finalizada" : "Ao vivo"}
                </Badge>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
