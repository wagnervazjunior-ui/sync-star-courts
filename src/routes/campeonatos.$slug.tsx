import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/campeonatos/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Open Sync` }] }),
  component: DetailPage,
});

function DetailPage() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["championship", slug],
    queryFn: async () => {
      const { data: ch, error } = await supabase.from("championships").select("*").eq("slug", slug).eq("active", true).maybeSingle();
      if (error) throw error;
      if (!ch) throw notFound();
      const { data: cats } = await supabase.from("categories").select("*").eq("championship_id", ch.id).eq("active", true).order("name");
      // availability per category
      const availability: Record<string, number> = {};
      await Promise.all((cats ?? []).map(async (cat) => {
        const { data: a } = await supabase.rpc("get_category_availability", { _category_id: cat.id });
        availability[cat.id] = a ?? 0;
      }));
      return { ch, cats: cats ?? [], availability };
    },
  });

  if (isLoading) return <div className="min-h-screen"><PublicHeader /><p className="p-8 text-muted-foreground">Carregando…</p></div>;
  if (!data) return null;
  const { ch, cats, availability } = data;

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main>
        {ch.cover_image_url && (
          <div className="relative h-64 overflow-hidden md:h-80">
            <img src={ch.cover_image_url} alt={ch.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </div>
        )}
        <div className="mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-4xl font-bold md:text-5xl">{ch.name}</h1>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {ch.start_date && <span className="flex items-center gap-2"><Calendar className="size-4" /> {new Date(ch.start_date).toLocaleDateString("pt-BR")}{ch.end_date && ` — ${new Date(ch.end_date).toLocaleDateString("pt-BR")}`}</span>}
            {ch.location && <span className="flex items-center gap-2"><MapPin className="size-4" /> {ch.location}</span>}
          </div>
          {ch.description && <p className="mt-6 whitespace-pre-line text-foreground/80">{ch.description}</p>}

          <h2 className="mt-12 text-2xl font-bold">Categorias</h2>
          <div className="mt-4 grid gap-4">
            {cats.map((cat) => {
              const avail = availability[cat.id] ?? 0;
              const full = avail === 0;
              return (
                <Card key={cat.id} className="p-6 bg-gradient-card border-border/50">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-bold">{cat.name}</h3>
                        <Badge variant={full ? "destructive" : "secondary"} className="gap-1">
                          <Users className="size-3" /> {avail}/{cat.max_slots} vagas
                        </Badge>
                      </div>
                      {cat.description && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{cat.description}</p>}
                      <p className="mt-3 text-lg font-semibold">R$ {(cat.price_cents / 100).toFixed(2).replace(".", ",")}</p>
                    </div>
                    <Button variant={full ? "secondary" : "hero"} disabled={full} asChild={!full}>
                      {full ? <span>Esgotado</span> : <Link to="/inscricao/$categoryId" params={{ categoryId: cat.id }}>Inscrever dupla</Link>}
                    </Button>
                  </div>
                </Card>
              );
            })}
            {cats.length === 0 && <p className="text-muted-foreground">Nenhuma categoria disponível.</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
