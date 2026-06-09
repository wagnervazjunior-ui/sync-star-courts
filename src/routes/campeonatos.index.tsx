import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Search } from "lucide-react";
import { setPublicCacheHeaders } from "@/lib/public-cache.functions";

export const Route = createFileRoute("/campeonatos/")({
  head: () => ({ meta: [{ title: "Campeonatos — Open Sync" }, { name: "description", content: "Veja todos os campeonatos abertos para inscrição." }] }),
  loader: () => setPublicCacheHeaders(),
  component: ListPage,
});

function ListPage() {
  const [search, setSearch] = useState("");

  // Campeonatos ativos que terminaram há no máximo 5 dias
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 5);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ["championships-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("championships")
        .select("*")
        .eq("active", true)
        .or(`end_date.is.null,end_date.gte.${cutoffDate}`)
        .order("start_date");
      if (error) throw error;
      return data;
    },
  });

  const filtered = (data ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 pb-28 md:pb-12">
        <h1 className="text-3xl font-bold md:text-4xl">Campeonatos</h1>
        <p className="mt-1 text-sm text-muted-foreground md:mt-2 md:text-base">
          Escolha um campeonato e inscreva sua dupla.
        </p>

        {/* Busca */}
        <div className="mt-5 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar campeonato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden bg-gradient-card border-border/50">
              <Skeleton className="aspect-video w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          ))}

          {filtered.map((c) => (
            <Link key={c.id} to="/campeonatos/$slug" params={{ slug: c.slug }}>
              <Card className="group h-full overflow-hidden bg-gradient-card border-border/50 transition-all hover:shadow-elegant active:scale-[0.98]">
                {c.cover_image_url ? (
                  <div className="overflow-hidden bg-muted">
                    <img src={c.cover_image_url} alt={c.name} className="w-full h-auto transition-transform group-hover:scale-105" loading="lazy" />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-primary opacity-20" />
                )}
                <div className="p-4">
                  <h3 className="font-bold leading-tight">{c.name}</h3>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {c.start_date && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 shrink-0" />
                        {new Date(c.start_date).toLocaleDateString("pt-BR")}
                        {c.end_date && ` — ${new Date(c.end_date).toLocaleDateString("pt-BR")}`}
                      </div>
                    )}
                    {c.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{c.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}

          {!isLoading && filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground">
              {search ? `Nenhum campeonato encontrado para "${search}".` : "Nenhum campeonato ativo no momento."}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
