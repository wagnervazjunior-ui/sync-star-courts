import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, MapPin, Trophy, Zap, Users, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Open Sync — Inscrições de Futevôlei" },
      { name: "description", content: "Inscreva sua dupla em campeonatos de futevôlei. Voucher na hora, pagamento online e gestão completa." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: championships } = useQuery({
    queryKey: ["public-championships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("championships")
        .select("*")
        .eq("active", true)
        .order("start_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Zap className="size-3" /> Plataforma oficial de inscrições
              </span>
              <h1 className="mt-6 text-5xl font-bold leading-tight md:text-7xl">
                Inscreva sua dupla.<br />
                <span className="text-gradient">Caia na areia.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                Inscrições rápidas para campeonatos de futevôlei, com voucher imediato, controle de vagas em tempo real e pagamento online.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="hero" size="xl" asChild>
                  <Link to="/campeonatos">Ver campeonatos <Trophy className="size-5" /></Link>
                </Button>
                <Button variant="premium" size="xl" asChild>
                  <Link to="/voucher">Já tenho voucher</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Active championships */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-3xl font-bold">Campeonatos ativos</h2>
            <Link to="/campeonatos" className="text-sm text-primary hover:underline">Ver todos →</Link>
          </div>
          {championships && championships.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-3">
              {championships.map((c) => (
                <Link key={c.id} to="/campeonatos/$slug" params={{ slug: c.slug }}>
                  <Card className="group h-full overflow-hidden bg-gradient-card border-border/50 transition-all hover:shadow-elegant hover:-translate-y-1">
                    {c.cover_image_url && (
                      <div className="aspect-video overflow-hidden bg-muted">
                        <img src={c.cover_image_url} alt={c.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="text-lg font-bold">{c.name}</h3>
                      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                        {c.start_date && <div className="flex items-center gap-2"><Calendar className="size-4" /> {new Date(c.start_date).toLocaleDateString("pt-BR")}</div>}
                        {c.location && <div className="flex items-center gap-2"><MapPin className="size-4" /> {c.location}</div>}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center bg-gradient-card border-border/50">
              <p className="text-muted-foreground">Nenhum campeonato disponível no momento.</p>
            </Card>
          )}
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="mb-10 text-center text-3xl font-bold">Como funciona</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: Trophy, title: "Escolha o campeonato", desc: "Veja categorias, premiação e vagas restantes." },
              { icon: Users, title: "Inscreva a dupla", desc: "Preencha os dados e tamanho de uniforme dos dois atletas." },
              { icon: FileSpreadsheet, title: "Receba o voucher", desc: "Voucher único + e-mail de confirmação na hora." },
            ].map((s, i) => (
              <Card key={i} className="p-6 bg-gradient-card border-border/50">
                <div className="inline-flex size-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
                  <s.icon className="size-6" />
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-border/40 mt-12">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Open Sync — Sistema de Gestão de Inscrições
        </div>
      </footer>
    </div>
  );
}
