import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, MapPin, Trophy, Zap, Users, FileSpreadsheet, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Open Sync — Inscrições de Campeonatos" },
      { name: "description", content: "Inscreva sua dupla em campeonatos. Voucher na hora, pagamento online e gestão completa." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: championships } = useQuery({
    queryKey: ["public-championships"],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 5);
      const cutoffDate = cutoff.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("championships")
        .select("*")
        .eq("active", true)
        .or(`end_date.is.null,end_date.gte.${cutoffDate}`)
        .order("start_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen">
      <PublicHeader />

      <main className="pb-24 md:pb-0">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-28">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Zap className="size-3" /> Plataforma oficial de inscrições
              </span>
              <h1 className="mt-4 text-4xl font-bold leading-tight md:text-7xl md:mt-6">
                Inscreva sua dupla.<br />
                <span className="text-gradient">Caia na areia.</span>
              </h1>
              <p className="mt-4 max-w-xl text-base text-muted-foreground md:mt-6 md:text-lg">
                Inscrições rápidas para campeonatos, com voucher imediato, controle de vagas em tempo real e pagamento online.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
                <Button variant="hero" size="lg" asChild className="w-full sm:w-auto h-12 text-base">
                  <Link to="/campeonatos">Ver campeonatos <Trophy className="size-5" /></Link>
                </Button>
                <Button variant="premium" size="lg" asChild className="w-full sm:w-auto h-12 text-base">
                  <Link to="/voucher">Já tenho voucher</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Active championships */}
        {championships && championships.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-12">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold md:text-3xl">Campeonatos ativos</h2>
              <Link to="/campeonatos" className="flex items-center gap-1 text-sm text-primary hover:underline">
                Ver todos <ChevronRight className="size-4" />
              </Link>
            </div>

            {/* Mobile: horizontal scroll. Desktop: grid */}
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
              {championships.map((c) => (
                <Link
                  key={c.id}
                  to="/campeonatos/$slug"
                  params={{ slug: c.slug }}
                  className="shrink-0 w-72 snap-start md:w-auto"
                >
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
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-10 md:py-16">
          <h2 className="mb-6 text-center text-2xl font-bold md:mb-10 md:text-3xl">Como funciona</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Trophy, title: "Escolha o campeonato", desc: "Veja categorias, premiação e vagas restantes." },
              { icon: Users, title: "Inscreva a dupla", desc: "Preencha os dados e tamanho de uniforme dos dois atletas." },
              { icon: FileSpreadsheet, title: "Receba o voucher", desc: "Voucher único + e-mail de confirmação na hora." },
            ].map((s, i) => (
              <Card key={i} className="flex items-start gap-4 p-5 bg-gradient-card border-border/50 sm:flex-col sm:items-start">
                <div className="inline-flex shrink-0 size-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
                  <s.icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 pb-24 md:pb-0">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Open Sync — Sistema de Gestão de Inscrições
        </div>
      </footer>
    </div>
  );
}
