import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Calendar, MapPin } from "lucide-react";

export const Route = createFileRoute("/campeonatos/")({
  head: () => ({ meta: [{ title: "Campeonatos — Open Sync" }, { name: "description", content: "Veja todos os campeonatos de futevôlei abertos para inscrição." }] }),
  component: ListPage,
});

function ListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["championships-public"],
    queryFn: async () => {
      const { data, error } = await supabase.from("championships").select("*").eq("active", true).order("start_date");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-4xl font-bold">Campeonatos</h1>
        <p className="mt-2 text-muted-foreground">Escolha um campeonato para ver as categorias e inscrever sua dupla.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isLoading && <p className="text-muted-foreground">Carregando…</p>}
          {data?.map((c) => (
            <Link key={c.id} to="/campeonatos/$slug" params={{ slug: c.slug }}>
              <Card className="group h-full overflow-hidden bg-gradient-card border-border/50 transition-all hover:shadow-elegant hover:-translate-y-1">
                {c.cover_image_url ? (
                  <div className="aspect-video overflow-hidden">
                    <img src={c.cover_image_url} alt={c.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-primary opacity-30" />
                )}
                <div className="p-5">
                  <h3 className="text-lg font-bold">{c.name}</h3>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {c.start_date && <div className="flex items-center gap-2"><Calendar className="size-4" /> {new Date(c.start_date).toLocaleDateString("pt-BR")}{c.end_date && ` — ${new Date(c.end_date).toLocaleDateString("pt-BR")}`}</div>}
                    {c.location && <div className="flex items-center gap-2"><MapPin className="size-4" /> {c.location}</div>}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {data?.length === 0 && <p className="text-muted-foreground">Nenhum campeonato ativo.</p>}
        </div>
      </main>
    </div>
  );
}
