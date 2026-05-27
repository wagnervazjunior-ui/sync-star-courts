import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";
import { listBrackets } from "@/lib/brackets.functions";
import { CreateBracketDialog } from "@/components/brackets/CreateBracketDialog";

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
              <Link key={b.id} to="/admin/chaves/$bracketId" params={{ bracketId: b.id }} className="block">
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
