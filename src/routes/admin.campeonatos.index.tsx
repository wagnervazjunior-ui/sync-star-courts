import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Upload, X, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin/campeonatos/")({
  component: ChampionshipsPage,
});

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function ChampionshipsPage() {
  const qc = useQueryClient();
  const { canCreateChampionships } = useAuth();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["championships"],
    queryFn: async () => (await supabase.rpc("list_manageable_championships")).data ?? [],
  });

  const save = async (form: any) => {
    const payload = { ...form, slug: form.slug || slugify(form.name) };
    const op = editing?.id
      ? supabase.from("championships").update(payload).eq("id", editing.id)
      : supabase.from("championships").insert(payload);
    const { error } = await op;
    if (error) toast.error(error.message);
    else {
      toast.success("Salvo!");
      setOpen(false); setEditing(null);
      qc.invalidateQueries({ queryKey: ["championships"] });
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este campeonato? Todas as categorias e inscrições serão removidas.")) return;
    const { error } = await supabase.from("championships").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["championships"] }); }
  };

  const toggleVisibility = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from("championships").update({ active: !currentActive }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(!currentActive ? "Campeonato visível na página pública" : "Campeonato ocultado da página pública");
      qc.invalidateQueries({ queryKey: ["championships"] });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campeonatos</h1>
          <p className="text-muted-foreground">Gerencie campeonatos. Crie um campeonato antes de adicionar categorias.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          {canCreateChampionships ? (
            <DialogTrigger asChild>
              <Button variant="hero"><Plus className="size-4" /> Novo campeonato</Button>
            </DialogTrigger>
          ) : (
            <p className="text-xs text-muted-foreground max-w-xs text-right">Você não tem permissão para criar campeonatos. Peça ao admin master.</p>
          )}
          <ChampionshipDialog key={editing?.id ?? "new"} initial={editing} onSave={save} />
        </Dialog>
      </div>

      <div className="mt-6 grid gap-4">
        {data?.map((c) => (
          <Card key={c.id} className="p-5 bg-gradient-card border-border/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to="/admin/campeonatos/$id" params={{ id: c.id }} search={{ tab: "configuracoes" }} className="text-lg font-bold hover:text-primary hover:underline">
                    {c.name}
                  </Link>
                  <Badge variant={c.active ? "default" : "secondary"}>
                    {c.active ? "Visível" : "Oculto"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">/{c.slug}</p>
                {c.location && <p className="text-sm text-muted-foreground mt-1">{c.location}</p>}
              </div>
              <div className="flex gap-1 items-center">
                <Button
                  size="sm"
                  variant={c.active ? "outline" : "hero"}
                  onClick={() => toggleVisibility(c.id, c.active)}
                  title={c.active ? "Ocultar da página pública" : "Mostrar na página pública"}
                >
                  {c.active ? <><EyeOff className="size-4" /> Ocultar</> : <><Eye className="size-4" /> Publicar</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {data?.length === 0 && <Card className="p-8 text-center text-muted-foreground bg-gradient-card border-border/50">Nenhum campeonato. Crie o primeiro!</Card>}
      </div>
    </div>
  );
}

function ChampionshipDialog({ initial, onSave }: { initial: any; onSave: (v: any) => void }) {
  const [form, setForm] = useState(() => initial ?? {
    name: "", slug: "", description: "", start_date: "", end_date: "",
    location: "", location_url: "", location_embed_url: "", cover_image_url: "", banner_image_url: "", active: true,
    regulations: "", regulations_pdf_url: "", prize: "", policies: "", cancellation_policy: "",
    shirt_size_chart_urls: [] as string[], shirt_size_guarantee_until: "",
    uniform_models: [] as string[],
  });
  const [newModel, setNewModel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingChart, setUploadingChart] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const handleRegulationsPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      const path = `regulations/${crypto.randomUUID()}.pdf`;
      const { error } = await supabase.storage.from("championship-covers").upload(path, file, { upsert: false, contentType: "application/pdf" });
      if (error) throw error;
      const { data } = supabase.storage.from("championship-covers").getPublicUrl(path);
      setForm({ ...form, regulations_pdf_url: data.publicUrl });
      toast.success("PDF enviado!");
    } catch (err: any) {
      toast.error(err.message ?? "Falha no upload do PDF");
    } finally {
      setUploadingPdf(false);
      e.target.value = "";
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("championship-covers").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("championship-covers").getPublicUrl(path);
      setForm({ ...form, cover_image_url: data.publicUrl });
      toast.success("Imagem enviada!");
    } catch (err: any) {
      toast.error(err.message ?? "Falha no upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `banners/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("championship-covers").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("championship-covers").getPublicUrl(path);
      setForm({ ...form, banner_image_url: data.publicUrl });
      toast.success("Banner enviado!");
    } catch (err: any) {
      toast.error(err.message ?? "Falha no upload");
    } finally {
      setUploadingBanner(false);
      e.target.value = "";
    }
  };

  const handleChartFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingChart(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `size-charts/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("championship-covers").upload(path, file, { upsert: false, contentType: file.type });
        if (error) throw error;
        const { data } = supabase.storage.from("championship-covers").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setForm({ ...form, shirt_size_chart_urls: [...(form.shirt_size_chart_urls ?? []), ...urls] });
      toast.success(`${urls.length} imagem(ns) enviada(s)`);
    } catch (err: any) {
      toast.error(err.message ?? "Falha no upload");
    } finally {
      setUploadingChart(false);
      e.target.value = "";
    }
  };

  const removeChart = (url: string) => {
    setForm({ ...form, shirt_size_chart_urls: (form.shirt_size_chart_urls ?? []).filter((u: string) => u !== url) });
  };

  const handleSave = () => {
    const payload = {
      ...form,
      shirt_size_guarantee_until: form.shirt_size_guarantee_until || null,
      location_url: form.location_url || null,
      location_embed_url: form.location_embed_url || null,
      banner_image_url: form.banner_image_url || null,
      regulations: form.regulations || null,
      regulations_pdf_url: form.regulations_pdf_url || null,
      prize: form.prize || null,
      policies: form.policies || null,
      cancellation_policy: form.cancellation_policy || null,
    };
    onSave(payload);
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Editar" : "Novo"} campeonato</DialogTitle></DialogHeader>
      <div className="space-y-5">
        <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-2"><Label>Slug (URL)</Label><Input placeholder="auto-gerado" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
        <div className="space-y-2"><Label>Descrição</Label><Textarea rows={4} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="space-y-2"><Label>Premiação geral</Label><Textarea rows={3} value={form.prize ?? ""} onChange={(e) => setForm({ ...form, prize: e.target.value })} placeholder="Ex: 1º lugar R$ 5.000 + troféu, 2º lugar R$ 2.500..." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Início</Label><Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          <div className="space-y-2"><Label>Fim</Label><Input type="date" value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
        </div>

        <div className="rounded-lg border border-border/50 p-4 space-y-3">
          <h4 className="font-semibold text-sm">Local</h4>
          <div className="space-y-2"><Label>Local</Label><Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ex: Ginásio Nilson Nelson, Brasília — DF" /></div>
          <div className="space-y-2"><Label>Link Google Maps (botão "Como chegar")</Label><Input type="url" value={form.location_url ?? ""} onChange={(e) => setForm({ ...form, location_url: e.target.value })} placeholder="https://maps.google.com/..." /></div>
          <div className="space-y-2">
            <Label>Mapa incorporado (Google Maps)</Label>
            <Textarea
              rows={3}
              value={form.location_embed_url ?? ""}
              onChange={(e) => {
                const val = e.target.value.trim();
                const match = val.match(/src="([^"]+)"/);
                setForm({ ...form, location_embed_url: match ? match[1] : val });
              }}
              placeholder="Cole aqui o código iframe OU só a URL — qualquer formato funciona"
            />
            <p className="text-xs text-muted-foreground">Google Maps → Compartilhar → Incorporar um mapa → copie o código inteiro do iframe.</p>
            {form.location_embed_url && (
              <div className="rounded-lg overflow-hidden border border-border/50 mt-2">
                <iframe src={form.location_embed_url} width="100%" height="200" style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            )}
          </div>
        </div>

        {/* Foto do card */}
        <div className="space-y-2">
          <Label>Foto do campeonato <span className="text-xs font-normal text-muted-foreground">(card da listagem)</span></Label>
          <p className="text-xs text-muted-foreground">Tamanho ideal: <strong>1080 × 1080 px</strong> — quadrado, padrão Instagram</p>
          {form.cover_image_url && (
            <div className="relative rounded-lg overflow-hidden border border-border/50 max-w-[160px]">
              <img src={form.cover_image_url} alt="Capa" className="w-full h-auto block" />
              <Button type="button" size="sm" variant="ghost" className="absolute top-1 right-1 bg-background/80 backdrop-blur" onClick={() => setForm({ ...form, cover_image_url: "" })}>
                <X className="size-3" />
              </Button>
            </div>
          )}
          <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/30 transition-colors text-sm text-muted-foreground">
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? "Enviando..." : form.cover_image_url ? "Trocar foto" : "Selecionar foto"}
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
        </div>

        {/* Banner do cabeçalho */}
        <div className="space-y-2">
          <Label>Banner do cabeçalho <span className="text-xs font-normal text-muted-foreground">(topo da página do campeonato)</span></Label>
          <p className="text-xs text-muted-foreground">Tamanho ideal: <strong>1200 × 400 px</strong> — paisagem, proporção 3:1. Se não preencher, usa a foto do card.</p>
          {form.banner_image_url && (
            <div className="relative rounded-lg overflow-hidden border border-border/50">
              <img src={form.banner_image_url} alt="Banner" className="w-full h-auto block" />
              <Button type="button" size="sm" variant="ghost" className="absolute top-2 right-2 bg-background/80 backdrop-blur" onClick={() => setForm({ ...form, banner_image_url: "" })}>
                <X className="size-4" />
              </Button>
            </div>
          )}
          <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/30 transition-colors text-sm text-muted-foreground">
            {uploadingBanner ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploadingBanner ? "Enviando..." : form.banner_image_url ? "Trocar banner" : "Selecionar banner"}
            <input type="file" accept="image/*" className="hidden" onChange={handleBannerFile} disabled={uploadingBanner} />
          </label>
        </div>

        <div className="rounded-lg border border-border/50 p-4 space-y-3">
          <h4 className="font-semibold text-sm">Uniforme</h4>
          <div className="space-y-2">
            <Label>Tabela de medidas <span className="text-xs font-normal text-muted-foreground">(uma ou mais imagens)</span></Label>
            <p className="text-xs text-muted-foreground">Tamanho sugerido: <strong>800 × 600 px ou maior</strong></p>
            {(form.shirt_size_chart_urls ?? []).length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {form.shirt_size_chart_urls.map((url: string) => (
                  <div key={url} className="relative rounded-md overflow-hidden border border-border/50">
                    <img src={url} alt="Tabela de medidas" className="w-full h-24 object-cover" />
                    <Button type="button" size="sm" variant="ghost" className="absolute top-1 right-1 h-6 w-6 p-0 bg-background/80 backdrop-blur" onClick={() => removeChart(url)}>
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/30 transition-colors text-sm text-muted-foreground">
              {uploadingChart ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploadingChart ? "Enviando..." : "Adicionar imagens"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleChartFiles} disabled={uploadingChart} />
            </label>
          </div>
          <div className="space-y-2">
            <Label>Data limite para garantia do tamanho</Label>
            <Input
              type="date"
              value={form.shirt_size_guarantee_until ? String(form.shirt_size_guarantee_until).slice(0, 10) : ""}
              onChange={(e) => setForm({ ...form, shirt_size_guarantee_until: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Após essa data, o tamanho fica sujeito à disponibilidade.</p>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 p-4 space-y-3">
          <h4 className="font-semibold text-sm">Modelos de uniforme</h4>
          <p className="text-xs text-muted-foreground">Ex.: Amador, Convidados, Profissional. Cada categoria seleciona um modelo dessa lista.</p>
          {(form.uniform_models ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.uniform_models.map((m: string) => (
                <Badge key={m} variant="secondary" className="gap-1">
                  {m}
                  <button type="button" onClick={() => setForm({ ...form, uniform_models: form.uniform_models.filter((x: string) => x !== m) })}>
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Nome do modelo"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = newModel.trim();
                  if (v && !(form.uniform_models ?? []).includes(v)) {
                    setForm({ ...form, uniform_models: [...(form.uniform_models ?? []), v] });
                  }
                  setNewModel("");
                }
              }}
            />
            <Button type="button" variant="outline" onClick={() => {
              const v = newModel.trim();
              if (v && !(form.uniform_models ?? []).includes(v)) {
                setForm({ ...form, uniform_models: [...(form.uniform_models ?? []), v] });
              }
              setNewModel("");
            }}>Adicionar</Button>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 p-4 space-y-3">
          <h4 className="font-semibold text-sm">Textos legais</h4>
          <div className="space-y-2">
            <Label>Regulamento (texto)</Label>
            <Textarea rows={4} value={form.regulations ?? ""} onChange={(e) => setForm({ ...form, regulations: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Regulamento em PDF (opcional)</Label>
            {form.regulations_pdf_url && (
              <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm">
                <span className="flex-1 truncate">PDF carregado</span>
                <a href={form.regulations_pdf_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">Ver</a>
                <Button type="button" size="sm" variant="ghost" onClick={() => setForm({ ...form, regulations_pdf_url: "" })}><X className="size-3" /></Button>
              </div>
            )}
            <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/30 transition-colors text-sm text-muted-foreground">
              {uploadingPdf ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploadingPdf ? "Enviando..." : form.regulations_pdf_url ? "Trocar PDF" : "Selecionar PDF"}
              <input type="file" accept="application/pdf" className="hidden" onChange={handleRegulationsPdf} disabled={uploadingPdf} />
            </label>
          </div>
          <div className="space-y-2"><Label>Políticas do evento</Label><Textarea rows={4} value={form.policies ?? ""} onChange={(e) => setForm({ ...form, policies: e.target.value })} /></div>
          <div className="space-y-2"><Label>Política de cancelamento e reembolso</Label><Textarea rows={4} value={form.cancellation_policy ?? ""} onChange={(e) => setForm({ ...form, cancellation_policy: e.target.value })} /></div>
        </div>

        <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
      </div>
      <DialogFooter><Button variant="hero" onClick={handleSave} disabled={uploading || uploadingBanner || uploadingChart || uploadingPdf}>Salvar</Button></DialogFooter>
    </DialogContent>
  );
}
