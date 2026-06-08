import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Calendar, MapPin, ExternalLink, Trophy, FileText, Clock } from "lucide-react";
import { setPublicCacheHeaders } from "@/lib/public-cache.functions";

export const Route = createFileRoute("/campeonatos/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Open Sync` }] }),
  loader: () => setPublicCacheHeaders(),
  component: DetailPage,
});

function extractMapSrc(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/src="([^"]+)"/);
  return match ? match[1] : value.startsWith("http") ? value : null;
}

function DetailPage() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["championship", slug],
    queryFn: async () => {
      const { data: ch, error } = await supabase.from("championships").select("*").eq("slug", slug).eq("active", true).maybeSingle();
      if (error) throw error;
      if (!ch) throw notFound();
      const { data: cats } = await supabase.from("categories").select("*").eq("championship_id", ch.id).eq("active", true).eq("visible", true).order("name");
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
      <main className="pb-24 md:pb-0">
        {((ch as any).banner_image_url || ch.cover_image_url) && (
          <div className="relative w-full overflow-hidden">
            <img
              src={(ch as any).banner_image_url || ch.cover_image_url}
              alt={ch.name}
              className="w-full h-auto block"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
          </div>
        )}
        <div className="mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-4xl font-bold md:text-5xl">{ch.name}</h1>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {ch.start_date && <span className="flex items-center gap-2"><Calendar className="size-4" /> {new Date(ch.start_date).toLocaleDateString("pt-BR")}{ch.end_date && ` — ${new Date(ch.end_date).toLocaleDateString("pt-BR")}`}</span>}
            {ch.location && <span className="flex items-center gap-2"><MapPin className="size-4" /> {ch.location}</span>}
          </div>
          {ch.description && <p className="mt-6 whitespace-pre-line text-foreground/80 text-justify hyphens-auto">{ch.description}</p>}

          <h2 className="mt-10 text-2xl font-bold">Categorias</h2>
          <div className="mt-4 grid gap-3">
            {cats.map((cat) => {
              const full = (availability[cat.id] ?? 0) === 0;
              const opensAt = (cat as any).opens_at ? new Date((cat as any).opens_at) : null;
              const notOpenYet = opensAt && opensAt > new Date();
              return (
                <Card key={cat.id} className="p-5 bg-gradient-card border-border/50">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold leading-tight">{cat.name}</h3>
                        {cat.description && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{cat.description}</p>
                        )}
                        {notOpenYet && (
                          <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-400">
                            <Clock className="size-3.5" />
                            Inscrições abrem em {opensAt.toLocaleDateString("pt-BR")} às {opensAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-2xl font-bold">
                        R$ {(cat.price_cents / 100).toFixed(2).replace(".", ",")}
                      </p>
                      <Button
                        variant={full || notOpenYet ? "secondary" : "hero"}
                        disabled={full || !!notOpenYet}
                        className="h-11 px-6 text-sm font-semibold"
                        asChild={!full && !notOpenYet}
                      >
                        {full
                          ? <span>Esgotado</span>
                          : notOpenYet
                            ? <span>Em breve</span>
                            : <Link to="/inscricao/$categoryId" params={{ categoryId: cat.id }}>Inscrever dupla →</Link>
                        }
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
            {cats.length === 0 && <p className="text-muted-foreground py-6 text-center">Nenhuma categoria disponível.</p>}
          </div>

          {(ch.location || ch.location_url || (ch as any).location_embed_url) && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold">Local do evento</h2>
              <Card className="mt-4 bg-gradient-card border-border/50 overflow-hidden">
                {extractMapSrc((ch as any).location_embed_url) && (
                  <div className="w-full" style={{ height: 320 }}>
                    <iframe
                      src={extractMapSrc((ch as any).location_embed_url)!}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                )}
                <div className="p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="size-5 text-primary mt-0.5" />
                    <div>
                      {ch.location && <p className="font-medium">{ch.location}</p>}
                      {ch.location_url && <p className="text-xs text-muted-foreground">Clique para ver como chegar</p>}
                    </div>
                  </div>
                  {ch.location_url && (
                    <Button asChild variant="premium">
                      <a href={ch.location_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-4" /> Abrir no Google Maps
                      </a>
                    </Button>
                  )}
                </div>
              </Card>
            </section>
          )}

          {(ch as any).prize && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Trophy className="size-6 text-primary" /> Premiação</h2>
              <Card className="mt-4 p-5 bg-gradient-card border-border/50">
                <p className="whitespace-pre-line text-foreground/80 text-justify hyphens-auto">{(ch as any).prize}</p>
              </Card>
            </section>
          )}

          {(ch.regulations || ch.policies || ch.cancellation_policy || (ch as any).regulations_pdf_url) && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold">Informações do evento</h2>
              {(ch as any).regulations_pdf_url && (
                <Button asChild variant="outline" className="mt-4">
                  <a href={(ch as any).regulations_pdf_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="size-4" /> Baixar Regulamento (PDF)
                  </a>
                </Button>
              )}
              <Accordion type="single" collapsible className="mt-4">
                {ch.regulations && (
                  <AccordionItem value="regulations">
                    <AccordionTrigger>Regulamento</AccordionTrigger>
                    <AccordionContent className="whitespace-pre-line text-foreground/80 text-justify hyphens-auto">{ch.regulations}</AccordionContent>
                  </AccordionItem>
                )}
                {ch.policies && (
                  <AccordionItem value="policies">
                    <AccordionTrigger>Políticas do evento</AccordionTrigger>
                    <AccordionContent className="whitespace-pre-line text-foreground/80 text-justify hyphens-auto">{ch.policies}</AccordionContent>
                  </AccordionItem>
                )}
                {ch.cancellation_policy && (
                  <AccordionItem value="cancellation">
                    <AccordionTrigger>Política de cancelamento e reembolso</AccordionTrigger>
                    <AccordionContent className="whitespace-pre-line text-foreground/80 text-justify hyphens-auto">{ch.cancellation_policy}</AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
