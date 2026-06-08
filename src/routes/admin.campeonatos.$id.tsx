import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, ArrowLeft, ExternalLink, AlertTriangle, Users, ClipboardList, Shield,
  Upload, X, Loader2, Settings, BarChart3, FileSpreadsheet, ListChecks, Download, CheckCircle2, XCircle, UserPlus, Wallet, FileText, Copy, Network, RefreshCw,
} from "lucide-react";
import { generateGateListWorkbook } from "@/lib/gate-list-export";
import { generateUniformWorkbook } from "@/lib/uniform-export";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListReimbursements, setReimbursementStatus, getReceiptSignedUrl,
  adminListFees, setFeeStatus, getFeeReceiptSignedUrl, exportStaffFinanceXlsx,
} from "@/lib/staff.functions";
import { listBrackets } from "@/lib/brackets.functions";
import {
  createOrRotateRefereeInvite, listRefereeInvites, listChampionshipReferees, revokeRefereeFromChampionship,
} from "@/lib/referee.functions";
import { CreateBracketDialog } from "@/components/brackets/CreateBracketDialog";
import { SimulateBracketDialog } from "@/components/brackets/SimulateBracketDialog";

type TabKey = "configuracoes" | "dashboard" | "categorias" | "inscricoes" | "planilhas" | "staff" | "chaves" | "arbitros" | "permissoes";

const tabSchema = z.object({
  tab: fallback(z.enum(["configuracoes", "dashboard", "categorias", "inscricoes", "planilhas", "staff", "chaves", "arbitros", "permissoes"]), "configuracoes").default("configuracoes"),
});

export const Route = createFileRoute("/admin/campeonatos/$id")({
  validateSearch: zodValidator(tabSchema),
  component: ChampionshipDetail,
});

const GENDER_LABEL: Record<string, string> = { male: "Masculina", female: "Feminina", mixed: "Mista" };
const STATUS_LABEL: Record<string, string> = { pending: "Pendente", confirmed: "Confirmada", cancelled: "Cancelada" };

function ChampionshipDetail() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { isMaster } = useAuth();

  const { data: ch } = useQuery({
    queryKey: ["championship-admin", id],
    queryFn: async () => (await supabase.from("championships").select("*").eq("id", id).maybeSingle()).data,
  });

  const setTab = (t: TabKey) => navigate({ to: "/admin/campeonatos/$id", params: { id }, search: { tab: t } });

  return (
    <div>
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/campeonatos"><ArrowLeft className="size-4" /> Campeonatos</Link>
      </Button>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-bold">{ch?.name ?? "…"}</h1>
            {ch && <Badge variant={ch.active ? "default" : "secondary"}>{ch.active ? "Ativo" : "Inativo"}</Badge>}
          </div>
          {ch?.slug && <p className="text-xs text-muted-foreground mt-1">/{ch.slug}</p>}
        </div>
        {ch?.slug && (
          <Button variant="outline" asChild>
            <a href={`/campeonatos/${ch.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" /> Ver página pública
            </a>
          </Button>
        )}
      </div>

      {ch && !ch.active && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          <AlertTriangle className="size-4 mt-0.5" />
          <span>Este campeonato está <strong>inativo</strong> e não aparece publicamente.</span>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mt-6">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="configuracoes"><Settings className="size-4 mr-1" /> Configurações</TabsTrigger>
          <TabsTrigger value="dashboard"><BarChart3 className="size-4 mr-1" /> Dashboard</TabsTrigger>
          <TabsTrigger value="categorias"><ListChecks className="size-4 mr-1" /> Categorias</TabsTrigger>
          <TabsTrigger value="inscricoes"><Users className="size-4 mr-1" /> Inscrições</TabsTrigger>
          <TabsTrigger value="planilhas"><FileSpreadsheet className="size-4 mr-1" /> Planilhas</TabsTrigger>
          <TabsTrigger value="staff"><Wallet className="size-4 mr-1" /> Staff</TabsTrigger>
          <TabsTrigger value="chaves"><Network className="size-4 mr-1" /> Chaves</TabsTrigger>
          <TabsTrigger value="arbitros"><Users className="size-4 mr-1" /> Árbitros</TabsTrigger>
          {isMaster && <TabsTrigger value="permissoes"><Shield className="size-4 mr-1" /> Permissões</TabsTrigger>}
        </TabsList>

        <TabsContent value="configuracoes" className="mt-6">
          {ch ? <ConfigTab championship={ch} /> : <p className="text-muted-foreground">Carregando…</p>}
        </TabsContent>
        <TabsContent value="dashboard" className="mt-6"><DashboardTab id={id} championship={ch} /></TabsContent>
        <TabsContent value="categorias" className="mt-6"><CategoriesTab id={id} championship={ch} /></TabsContent>
        <TabsContent value="inscricoes" className="mt-6"><InscricoesTab id={id} /></TabsContent>
        <TabsContent value="planilhas" className="mt-6"><PlanilhasTab id={id} championship={ch} /></TabsContent>
        <TabsContent value="staff" className="mt-6"><StaffTab id={id} /></TabsContent>
        <TabsContent value="chaves" className="mt-6"><ChavesTab id={id} /></TabsContent>
        <TabsContent value="arbitros" className="mt-6"><ArbitrosTab id={id} /></TabsContent>
        {isMaster && <TabsContent value="permissoes" className="mt-6"><PermissoesTab id={id} /></TabsContent>}
      </Tabs>
    </div>
  );
}

/* =================== CONFIGURAÇÕES =================== */
function extractMapSrc(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/src="([^"]+)"/);
  return match ? match[1] : value.startsWith("http") ? value : null;
}

function ConfigTab({ championship }: { championship: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(() => ({
    ...championship,
    location_embed_url: extractMapSrc(championship.location_embed_url) ?? "",
  }));
  const [newModel, setNewModel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingChart, setUploadingChart] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [saving, setSaving] = useState(false);

  const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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
    } catch (err: any) { toast.error(err.message ?? "Falha no upload"); }
    finally { setUploading(false); e.target.value = ""; }
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
    } catch (err: any) { toast.error(err.message ?? "Falha no upload"); }
    finally { setUploadingBanner(false); e.target.value = ""; }
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
    } catch (err: any) { toast.error(err.message ?? "Falha no upload"); }
    finally { setUploadingChart(false); e.target.value = ""; }
  };

  const removeChart = (url: string) => setForm({ ...form, shirt_size_chart_urls: (form.shirt_size_chart_urls ?? []).filter((u: string) => u !== url) });

  const save = async () => {
    setSaving(true);
    const payload: any = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      description: form.description ?? null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      location: form.location ?? null,
      location_url: form.location_url || null,
      location_embed_url: form.location_embed_url || null,
      cover_image_url: form.cover_image_url || null,
      banner_image_url: form.banner_image_url || null,
      active: form.active,
      prize: form.prize || null,
      regulations: form.regulations || null,
      regulations_pdf_url: form.regulations_pdf_url || null,
      policies: form.policies || null,
      cancellation_policy: form.cancellation_policy || null,
      shirt_size_chart_urls: form.shirt_size_chart_urls ?? [],
      shirt_size_guarantee_until: form.shirt_size_guarantee_until || null,
      uniform_models: form.uniform_models ?? [],
    };
    const { error } = await supabase.from("championships").update(payload).eq("id", championship.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Salvo!"); qc.invalidateQueries({ queryKey: ["championship-admin", championship.id] }); qc.invalidateQueries({ queryKey: ["championships"] }); }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex justify-end">
        <Button variant="hero" onClick={save} disabled={saving || uploading || uploadingBanner || uploadingChart || uploadingPdf}>{saving ? "Salvando…" : "Salvar alterações"}</Button>
      </div>
      <div className="space-y-2"><Label>Nome</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="space-y-2"><Label>Slug (URL)</Label><Input placeholder="auto-gerado" value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
      <div className="space-y-2"><Label>Descrição</Label><Textarea rows={4} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="space-y-2"><Label>Premiação geral</Label><Textarea rows={3} value={form.prize ?? ""} onChange={(e) => setForm({ ...form, prize: e.target.value })} placeholder="Ex: 1º lugar R$ 5.000 + troféu, 2º lugar R$ 2.500..." /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Início</Label><Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
        <div className="space-y-2"><Label>Fim</Label><Input type="date" value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
      </div>

      <div className="rounded-lg border border-border/50 p-4 space-y-3">
        <h4 className="font-semibold text-sm">Local</h4>
        <div className="space-y-2"><Label>Local</Label><Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
        <div className="space-y-2"><Label>Link Google Maps (botão "Como chegar")</Label><Input type="url" value={form.location_url ?? ""} onChange={(e) => setForm({ ...form, location_url: e.target.value })} /></div>
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
              <iframe src={form.location_embed_url} width="100%" height="220" style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </div>
          )}
        </div>
      </div>

      {/* Foto do card (quadrada) */}
      <div className="space-y-2">
        <Label>Foto do campeonato <span className="text-xs font-normal text-muted-foreground">(aparece nos cards de listagem)</span></Label>
        <p className="text-xs text-muted-foreground">Tamanho ideal: <strong>1080 × 1080 px</strong> — quadrado, padrão Instagram</p>
        {form.cover_image_url && (
          <div className="relative rounded-lg overflow-hidden border border-border/50 max-w-[200px]">
            <img src={form.cover_image_url} alt="Capa" className="w-full h-auto block" />
            <Button type="button" size="sm" variant="ghost" className="absolute top-2 right-2 bg-background/80 backdrop-blur" onClick={() => setForm({ ...form, cover_image_url: "" })}>
              <X className="size-4" />
            </Button>
          </div>
        )}
        <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/30 transition-colors text-sm text-muted-foreground">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading ? "Enviando..." : form.cover_image_url ? "Trocar foto" : "Selecionar foto"}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      </div>

      {/* Banner do cabeçalho (wide) */}
      <div className="space-y-2">
        <Label>Banner do cabeçalho <span className="text-xs font-normal text-muted-foreground">(aparece no topo da página do campeonato)</span></Label>
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
          <p className="text-xs text-muted-foreground">Tamanho sugerido: <strong>800 × 600 px ou maior</strong> — qualquer proporção, será exibida no tamanho real</p>
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
          <Input type="date" value={form.shirt_size_guarantee_until ? String(form.shirt_size_guarantee_until).slice(0, 10) : ""} onChange={(e) => setForm({ ...form, shirt_size_guarantee_until: e.target.value })} />
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
          <Input placeholder="Nome do modelo" value={newModel} onChange={(e) => setNewModel(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const v = newModel.trim();
              if (v && !(form.uniform_models ?? []).includes(v)) setForm({ ...form, uniform_models: [...(form.uniform_models ?? []), v] });
              setNewModel("");
            }
          }} />
          <Button type="button" variant="outline" onClick={() => {
            const v = newModel.trim();
            if (v && !(form.uniform_models ?? []).includes(v)) setForm({ ...form, uniform_models: [...(form.uniform_models ?? []), v] });
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

      <div className="flex items-center gap-2"><Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>

      <div className="flex justify-end pt-4 border-t border-border/40">
        <Button variant="hero" onClick={save} disabled={saving || uploading || uploadingBanner || uploadingChart || uploadingPdf}>{saving ? "Salvando…" : "Salvar alterações"}</Button>
      </div>
    </div>
  );
}

/* =================== DASHBOARD =================== */
function DashboardTab({ id, championship }: { id: string; championship: any }) {
  const { data: cats } = useQuery({
    queryKey: ["categories", id],
    queryFn: async () => (await supabase.from("categories").select("*").eq("championship_id", id)).data ?? [],
  });
  const { data: regs } = useQuery({
    queryKey: ["dash-regs", id],
    queryFn: async () => (await supabase.from("registrations").select("status, amount_cents, category:categories!inner(championship_id)").eq("category.championship_id", id)).data ?? [],
  });

  const stats = useMemo(() => {
    const r = regs ?? [];
    const pending = r.filter((x: any) => x.status === "pending").length;
    const confirmed = r.filter((x: any) => x.status === "confirmed").length;
    const cancelled = r.filter((x: any) => x.status === "cancelled").length;
    const revenue = r.filter((x: any) => x.status === "confirmed").reduce((s: number, x: any) => s + (x.amount_cents ?? 0), 0);
    const totalSlots = (cats ?? []).reduce((s: number, c: any) => s + (c.max_slots ?? 0), 0);
    const occupied = pending + confirmed;
    const occupation = totalSlots > 0 ? Math.round((occupied / totalSlots) * 100) : 0;
    const activeCats = (cats ?? []).filter((c: any) => c.active).length;
    return { pending, confirmed, cancelled, revenue, totalSlots, occupied, occupation, activeCats, totalCats: (cats ?? []).length };
  }, [regs, cats]);

  const Stat = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) => (
    <Card className="p-5 bg-gradient-card border-border/50">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </Card>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Stat label="Categorias" value={`${stats.activeCats}/${stats.totalCats}`} hint="ativas / total" />
      <Stat label="Inscrições confirmadas" value={stats.confirmed} />
      <Stat label="Inscrições pendentes" value={stats.pending} />
      <Stat label="Inscrições canceladas" value={stats.cancelled} />
      <Stat label="Receita confirmada" value={`R$ ${(stats.revenue / 100).toFixed(2).replace(".", ",")}`} />
      <Stat label="Ocupação" value={`${stats.occupation}%`} hint={`${stats.occupied} de ${stats.totalSlots} vagas`} />
      {championship?.start_date && <Stat label="Início" value={new Date(championship.start_date).toLocaleDateString("pt-BR")} />}
      {championship?.end_date && <Stat label="Fim" value={new Date(championship.end_date).toLocaleDateString("pt-BR")} />}
      {championship?.shirt_size_guarantee_until && <Stat label="Garantia de tamanho até" value={new Date(championship.shirt_size_guarantee_until).toLocaleDateString("pt-BR")} />}
    </div>
  );
}

/* =================== CATEGORIAS =================== */
function CategoriesTab({ id, championship }: { id: string; championship: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: cats } = useQuery({
    queryKey: ["categories", id],
    queryFn: async () => (await supabase.from("categories").select("*").eq("championship_id", id).order("name")).data ?? [],
  });
  const { data: counts } = useQuery({
    queryKey: ["category-counts", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("registrations")
        .select("category_id, status, category:categories!inner(championship_id)")
        .eq("category.championship_id", id)
        .neq("status", "cancelled");
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { map[r.category_id] = (map[r.category_id] ?? 0) + 1; });
      return map;
    },
  });

  const save = async (form: any) => {
    const payload: any = {
      ...form,
      championship_id: id,
      max_slots: Number(form.max_slots),
      price_cents: Math.round(Number(form.price_reais) * 100),
      uniform_model: form.uniform_model || null,
      age_rule_mode: form.age_rule_mode || "none",
      age_min: form.age_rule_mode && form.age_rule_mode !== "none" ? Number(form.age_min) : null,
      opens_at: form.opens_at ? new Date(form.opens_at).toISOString() : null,
    };
    delete payload.price_reais;
    const op = editing?.id
      ? supabase.from("categories").update(payload).eq("id", editing.id)
      : supabase.from("categories").insert(payload);
    const { error } = await op;
    if (error) toast.error(error.message);
    else { toast.success("Salvo!"); setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["categories", id] }); }
  };

  const remove = async (catId: string) => {
    if (!confirm("Excluir esta categoria?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", catId);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["categories", id] }); }
  };

  return (
    <div>
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button variant="hero"><Plus className="size-4" /> Nova categoria</Button></DialogTrigger>
          <CategoryDialog key={editing?.id ?? "new"} initial={editing} onSave={save} uniformModels={championship?.uniform_models ?? []} />
        </Dialog>
      </div>
      {championship?.active && cats && cats.length > 0 && cats.every((c: any) => !c.active) && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          <AlertTriangle className="size-4 mt-0.5" />
          <span>Nenhuma categoria está ativa. Ative pelo menos uma para que o público consiga se inscrever.</span>
        </div>
      )}
      <div className="mt-4 grid gap-3">
        {cats?.map((c: any) => {
          const inscritos = counts?.[c.id] ?? 0;
          const restantes = Math.max(0, c.max_slots - inscritos);
          return (
            <Card key={c.id} className="p-5 bg-gradient-card border-border/50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to="/admin/categorias/$categoryId" params={{ categoryId: c.id }} className="font-bold hover:text-primary hover:underline">{c.name}</Link>
                    <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Ativa" : "Inativa"}</Badge>
                    <Badge variant={c.visible ? "outline" : "secondary"}>{c.visible ? "Visível" : "Oculta"}</Badge>
                    <Badge variant="outline">{GENDER_LABEL[c.gender] ?? c.gender}</Badge>
                    {c.uniform_model && <Badge variant="outline">{c.uniform_model}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Users className="size-3" /> {inscritos}/{c.max_slots} inscritos · {restantes} vaga(s)</span>
                    <span>R$ {(c.price_cents / 100).toFixed(2).replace(".", ",")}</span>
                    {c.opens_at && <span className="inline-flex items-center gap-1">🕒 Abre {new Date(c.opens_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>}
                  </p>
                  {c.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line line-clamp-2">{c.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="premium" asChild><Link to="/admin/categorias/$categoryId" params={{ categoryId: c.id }}>Inscrições</Link></Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing({ ...c, price_reais: (c.price_cents / 100).toFixed(2) }); setOpen(true); }}><Pencil className="size-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="size-4 text-destructive" /></Button>
                </div>
              </div>
            </Card>
          );
        })}
        {cats?.length === 0 && <Card className="p-8 text-center text-muted-foreground bg-gradient-card border-border/50">Nenhuma categoria criada.</Card>}
      </div>
    </div>
  );
}

function CategoryDialog({ initial, onSave, uniformModels }: { initial: any; onSave: (v: any) => void; uniformModels: string[] }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    prize: initial?.prize ?? "",
    rules: initial?.rules ?? "",
    max_slots: initial?.max_slots ?? 16,
    price_reais: initial?.price_reais ?? "0",
    active: initial?.active ?? true,
    visible: initial?.visible ?? true,
    opens_at: initial?.opens_at ? new Date(initial.opens_at).toISOString().slice(0, 16) : "",
    gender: initial?.gender ?? "mixed",
    uniform_model: initial?.uniform_model ?? "",
    age_rule_mode: initial?.age_rule_mode ?? "none",
    age_min: initial?.age_min ?? "",
    has_prize: initial?.has_prize ?? false,
  }));
  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Editar" : "Nova"} categoria</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Iniciante Masculino" /></div>
        <div className="space-y-2"><Label>Descrição</Label><Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Categoria aberta para duplas iniciantes" /></div>
        <div className="space-y-2"><Label>Regras da Categoria</Label><Textarea rows={4} value={form.rules ?? ""} onChange={(e) => setForm({ ...form, rules: e.target.value })} placeholder="Ex: Sets de 21 pontos, saque rotativo, melhor de 3 sets..." /></div>
        <div className="space-y-2"><Label>Premiação</Label><Textarea rows={3} value={form.prize ?? ""} onChange={(e) => setForm({ ...form, prize: e.target.value })} placeholder="Ex: 1º lugar R$ 1.000 + troféu, 2º lugar R$ 500..." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Gênero</Label>
            <Select value={form.gender ?? "mixed"} onValueChange={(v) => setForm({ ...form, gender: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Masculina</SelectItem>
                <SelectItem value="female">Feminina</SelectItem>
                <SelectItem value="mixed">Mista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Modelo de uniforme</Label>
            <Select value={form.uniform_model ?? ""} onValueChange={(v) => setForm({ ...form, uniform_model: v })} disabled={uniformModels.length === 0}>
              <SelectTrigger><SelectValue placeholder={uniformModels.length === 0 ? "Cadastre modelos no campeonato" : "Selecione"} /></SelectTrigger>
              <SelectContent>
                {uniformModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Vagas</Label><Input type="number" min={1} value={form.max_slots} onChange={(e) => setForm({ ...form, max_slots: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Preço (R$)</Label>
            <Input type="number" step="0.01" min="10" value={form.price_reais} onChange={(e) => setForm({ ...form, price_reais: e.target.value })} />
            {Number(form.price_reais) > 0 && Number(form.price_reais) < 10 && (
              <p className="text-xs text-destructive">Mínimo R$ 10,00 (limite do processador de pagamento)</p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 p-3 space-y-3">
          <Label className="text-sm font-semibold">Regra de idade (categorias Master)</Label>
          <Select value={form.age_rule_mode ?? "none"} onValueChange={(v) => setForm({ ...form, age_rule_mode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem regra de idade</SelectItem>
              <SelectItem value="individual_min">Idade mínima por atleta</SelectItem>
              <SelectItem value="sum_min">Soma mínima das idades da dupla</SelectItem>
            </SelectContent>
          </Select>
          {form.age_rule_mode && form.age_rule_mode !== "none" && (
            <div className="space-y-2">
              <Label>{form.age_rule_mode === "individual_min" ? "Idade mínima de cada atleta" : "Soma mínima das idades"}</Label>
              <Input type="number" min={1} value={form.age_min ?? ""} onChange={(e) => setForm({ ...form, age_min: e.target.value })} />
              <p className="text-xs text-muted-foreground">A idade considerada é a completada no ano de início do campeonato.</p>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border/50 p-3 space-y-3">
          <Label className="text-sm font-semibold">Visibilidade e disponibilidade</Label>
          <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativa (aceita inscrições)</Label></div>
          <div className="flex items-center gap-2"><Switch checked={form.visible} onCheckedChange={(v) => setForm({ ...form, visible: v })} /><Label>Visível na página pública</Label></div>
          <div className="space-y-1.5">
            <Label>Abertura programada das inscrições</Label>
            <Input
              type="datetime-local"
              value={form.opens_at}
              onChange={(e) => setForm({ ...form, opens_at: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Se preenchido, o botão de inscrição fica bloqueado até essa data e hora.</p>
            {form.opens_at && (
              <button type="button" className="text-xs text-destructive hover:underline" onClick={() => setForm({ ...form, opens_at: "" })}>Remover data programada</button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2"><Switch checked={!!form.has_prize} onCheckedChange={(v) => setForm({ ...form, has_prize: v })} /><Label>Tem premiação em dinheiro</Label></div>
      </div>
      <DialogFooter><Button variant="hero" onClick={() => onSave(form)}>Salvar</Button></DialogFooter>
    </DialogContent>
  );
}

/* =================== INSCRIÇÕES =================== */
function InscricoesTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["categories", id],
    queryFn: async () => (await supabase.from("categories").select("*").eq("championship_id", id).order("name")).data ?? [],
  });
  const { data: regs, isLoading } = useQuery({
    queryKey: ["ch-regs", id],
    queryFn: async () => (await supabase.from("registrations").select("*, category:categories!inner(name, price_cents, championship_id)").eq("category.championship_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = useMemo(() => {
    return (regs ?? []).filter((r: any) => {
      if (categoryId !== "all" && r.category_id !== categoryId) return false;
      if (status !== "all" && r.status !== status) return false;
      if (search) {
        const s = search.toLowerCase();
        if (![r.voucher_code, r.contact_email, r.team_name, r.athlete1_name, r.athlete2_name].some((v: any) => v?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [regs, categoryId, status, search]);

  const updateStatus = async (rid: string, action: "confirm" | "cancel") => {
    const fn = action === "confirm" ? "confirm_registration" : "cancel_registration";
    const { error } = await supabase.rpc(fn, { _id: rid });
    if (error) toast.error(error.message);
    else { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["ch-regs", id] }); }
  };

  return (
    <div>
      <Card className="p-4 bg-gradient-card border-border/50 grid gap-3 md:grid-cols-3">
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {(categories ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="confirmed">Confirmadas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Buscar voucher / dupla / e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>
      <p className="text-xs text-muted-foreground mt-2">{filtered.length} resultado(s)</p>

      <div className="mt-4 grid gap-3">
        {isLoading && <p className="text-muted-foreground">Carregando…</p>}
        {filtered.map((r: any) => (
          <Card key={r.id} className="p-4 bg-gradient-card border-border/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-bold text-primary">{r.voucher_code}</code>
                  <Badge variant={r.status === "confirmed" ? "default" : r.status === "cancelled" ? "destructive" : "secondary"}>{STATUS_LABEL[r.status]}</Badge>
                  <span className="text-xs text-muted-foreground">{r.category?.name}</span>
                </div>
                <p className="mt-1 text-sm font-medium">{r.team_name} · {r.contact_phone}</p>
                <div className="mt-1 grid gap-1 text-sm md:grid-cols-2">
                  <div><strong>{r.athlete1_name}</strong> · cam {r.athlete1_shirt_size} / short {r.athlete1_shorts_size}</div>
                  <div><strong>{r.athlete2_name}</strong> · cam {r.athlete2_shirt_size} / short {r.athlete2_shorts_size}</div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.contact_email} · {new Date(r.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" asChild><Link to="/admin/categorias/$categoryId" params={{ categoryId: r.category_id }}>Editar</Link></Button>
                {r.status !== "confirmed" && <Button size="sm" variant="premium" onClick={() => updateStatus(r.id, "confirm")}><CheckCircle2 className="size-4" /></Button>}
                {r.status !== "cancelled" && <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "cancel")}><XCircle className="size-4 text-destructive" /></Button>}
              </div>
            </div>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && <Card className="p-8 text-center text-muted-foreground bg-gradient-card border-border/50">Nenhuma inscrição encontrada.</Card>}
      </div>
    </div>
  );
}

/* =================== PLANILHAS =================== */
function PlanilhasTab({ id, championship }: { id: string; championship: any }) {
  const [busy, setBusy] = useState<string | null>(null);

  const exportUniform = async () => {
    setBusy("uniform");
    try {
      const { data: cats } = await supabase.from("categories").select("*").eq("championship_id", id).order("name");
      const { data: regs } = await supabase
        .from("registrations")
        .select("*, category:categories!inner(name, championship_id)")
        .eq("category.championship_id", id)
        .eq("status", "confirmed");
      if (!regs || regs.length === 0) { toast.info("Nenhuma inscrição confirmada para exportar"); return; }
      await generateUniformWorkbook({
        championshipName: championship?.name ?? "",
        championshipSlug: championship?.slug ?? "campeonato",
        categories: (cats ?? []).map((c: any) => ({ ...c, registrations: (regs ?? []).filter((r: any) => r.category_id === c.id) })).filter((c: any) => c.registrations.length > 0),
      });
    } finally { setBusy(null); }
  };

  const exportGate = async () => {
    setBusy("gate");
    try {
      const { data: regs } = await supabase
        .from("registrations")
        .select("team_name, athlete1_name, athlete2_name, status, category_id, category:categories!inner(name, championship_id)")
        .eq("category.championship_id", id)
        .eq("status", "confirmed");
      const byCat = new Map<string, { name: string; registrations: any[] }>();
      (regs ?? []).forEach((r: any) => {
        const key = r.category_id;
        if (!byCat.has(key)) byCat.set(key, { name: r.category.name, registrations: [] });
        byCat.get(key)!.registrations.push(r);
      });
      await generateGateListWorkbook({
        championshipName: championship?.name ?? "",
        championshipSlug: championship?.slug ?? "campeonato",
        categories: Array.from(byCat.values()),
      });
    } finally { setBusy(null); }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
      <Card className="p-6 bg-gradient-card border-border/50 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><FileSpreadsheet className="size-4" /> Planilha de uniformes</h3>
        <p className="text-sm text-muted-foreground">Baixe a planilha com tamanhos de camisa e short de todas as inscrições confirmadas, agrupadas por categoria.</p>
        <Button variant="hero" onClick={exportUniform} disabled={busy === "uniform"}><Download className="size-4" /> {busy === "uniform" ? "Gerando…" : "Baixar uniformes"}</Button>
      </Card>
      <Card className="p-6 bg-gradient-card border-border/50 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><ClipboardList className="size-4" /> Lista da portaria</h3>
        <p className="text-sm text-muted-foreground">Lista de duplas confirmadas para conferência na entrada do evento.</p>
        <Button variant="hero" onClick={exportGate} disabled={busy === "gate"}><Download className="size-4" /> {busy === "gate" ? "Gerando…" : "Baixar lista"}</Button>
      </Card>
    </div>
  );
}

/* =================== ÁRBITROS =================== */
function ArbitrosTab({ id }: { id: string }) {
  const callRotate = useServerFn(createOrRotateRefereeInvite);
  const callInvite = useServerFn(listRefereeInvites);
  const callList = useServerFn(listChampionshipReferees);
  const callRevoke = useServerFn(revokeRefereeFromChampionship);

  const [rotating, setRotating] = useState(false);

  const invite = useQuery({
    queryKey: ["referee-invite", id],
    queryFn: () => callInvite({ data: { championship_id: id } }),
  });

  const referees = useQuery({
    queryKey: ["referee-list", id],
    queryFn: () => callList({ data: { championship_id: id } }),
  });

  const qc = useQueryClient();

  const rotate = async () => {
    setRotating(true);
    try {
      await callRotate({ data: { championship_id: id } });
      qc.invalidateQueries({ queryKey: ["referee-invite", id] });
      toast.success("Link gerado");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setRotating(false); }
  };

  const revoke = async (userId: string, email: string) => {
    if (!confirm(`Revogar acesso de ${email} a este campeonato?`)) return;
    try {
      await callRevoke({ data: { referee_user_id: userId, championship_id: id } });
      qc.invalidateQueries({ queryKey: ["referee-list", id] });
      toast.success("Acesso revogado");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  };

  const token = invite.data?.invite?.token;
  const inviteUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : "https://www.opensync.com.br"}/arbitro/cadastro/${token}`
    : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-muted-foreground">
        Gere um link de convite para árbitros. Quem se cadastrar pelo link terá acesso <strong>exclusivo às chaves</strong> deste campeonato.
      </p>

      <Card className="p-6 bg-gradient-card border-border/50 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Network className="size-4" /> Link de convite</h2>
        {inviteUrl ? (
          <div className="space-y-2">
            <code className="block text-xs break-all rounded bg-muted/40 p-2">{inviteUrl}</code>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success("Link copiado"); }}>
                <Copy className="size-4" /> Copiar
              </Button>
              <Button size="sm" variant="ghost" onClick={rotate} disabled={rotating}>
                <RefreshCw className="size-4" /> Gerar novo
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Nenhum link ativo. Gere um para compartilhar com os árbitros.</p>
            <Button size="sm" variant="hero" onClick={rotate} disabled={rotating}>
              {rotating ? <Loader2 className="size-4 animate-spin mr-2" /> : <UserPlus className="size-4 mr-2" />}
              Gerar link
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Ao gerar um novo link, o anterior é invalidado automaticamente.</p>
      </Card>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-4">Árbitros com acesso</h2>
        {referees.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (referees.data?.referees ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum árbitro cadastrado ainda.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {(referees.data!.referees as any[]).map((r) => (
              <li key={r.user_id} className="flex items-center justify-between py-3 gap-3">
                <div>
                  <p className="font-medium text-sm">{r.email}</p>
                  <p className="text-xs text-muted-foreground">desde {new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => revoke(r.user_id, r.email)} title="Revogar">
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* =================== PERMISSÕES =================== */
type PermRow = { user_id: string; email: string; granted_by: string | null; created_at: string };

function PermissoesTab({ id }: { id: string }) {
  const { isMaster, rolesLoading } = useAuth();
  const [rows, setRows] = useState<PermRow[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_championship_admins", { _championship_id: id });
    if (error) toast.error(error.message);
    else setRows((data as PermRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (isMaster) load(); }, [isMaster, id]);

  const grant = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("grant_championship_admin", { _championship_id: id, _email: email.trim() });
    setBusy(false);
    if (error) {
      const msg = error.message.includes("USER_NOT_FOUND") ? "E-mail não encontrado."
        : error.message.includes("NOT_ADMIN") ? "Esse usuário precisa ser admin antes."
        : error.message;
      toast.error(msg);
      return;
    }
    toast.success("Acesso concedido.");
    setEmail("");
    load();
  };

  const revoke = async (userId: string, mail: string) => {
    if (!confirm(`Revogar acesso de ${mail} a este campeonato?`)) return;
    const { error } = await supabase.rpc("revoke_championship_admin", { _championship_id: id, _user_id: userId });
    if (error) { toast.error(error.message); return; }
    toast.success("Acesso revogado.");
    load();
  };

  if (rolesLoading) return <p className="text-muted-foreground text-sm">Carregando…</p>;
  if (!isMaster) return <p className="text-muted-foreground text-sm">Acesso restrito ao admin master.</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-muted-foreground">Defina quais admins podem ver e editar este campeonato. O master e o criador sempre têm acesso.</p>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><UserPlus className="size-4" /> Conceder acesso</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1">
            <Label>E-mail do admin</Label>
            <Input type="email" placeholder="admin@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && grant()} />
          </div>
          <Button variant="hero" disabled={busy || !email.trim()} onClick={grant} className="sm:self-end">{busy ? "..." : "Adicionar"}</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">A pessoa precisa ter sido promovida a admin antes em <strong>Administradores</strong>.</p>
      </Card>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-4">Admins com acesso</h2>
        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum admin adicional. Apenas master e o criador têm acesso.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {rows.map((row) => (
              <li key={row.user_id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{row.email}</p>
                  <p className="text-xs text-muted-foreground">desde {new Date(row.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => revoke(row.user_id, row.email)} title="Revogar">
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* =================== STAFF (reembolsos & cachês por torneio) =================== */
const REIMB_CATEGORY_LABEL: Record<string, string> = {
  alimentacao: "Alimentação", transporte: "Transporte", passagem: "Passagem",
  gasolina: "Gasolina", hospedagem: "Hospedagem", outro: "Outro",
};
function brl(c: number) { return `R$ ${(c / 100).toFixed(2).replace(".", ",")}`; }

function StaffTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const callList = useServerFn(adminListReimbursements);
  const callStatus = useServerFn(setReimbursementStatus);
  const callReceipt = useServerFn(getReceiptSignedUrl);
  const callFees = useServerFn(adminListFees);
  const callFeeStatus = useServerFn(setFeeStatus);
  const callFeeReceipt = useServerFn(getFeeReceiptSignedUrl);
  const callExport = useServerFn(exportStaffFinanceXlsx);
  const [status, setStatus] = useState<string>("all");
  const [exporting, setExporting] = useState(false);

  const reimbs = useQuery({
    queryKey: ["champ-staff-reimbs", id, status],
    queryFn: () => callList({ data: { championship_id: id, status: status === "all" ? null : (status as any) } }),
  });
  const fees = useQuery({
    queryKey: ["champ-staff-fees", id, status],
    queryFn: () => callFees({ data: { championship_id: id, status: status === "all" ? null : (status as any) } }),
  });

  const rTotals = useMemo(() => {
    const rs = reimbs.data?.reimbursements ?? [];
    const total = rs.reduce((a: number, r: any) => a + r.amount_cents, 0);
    const paid = rs.filter((r: any) => r.status === "paid").reduce((a: number, r: any) => a + r.amount_cents, 0);
    return { total, paid, pending: total - paid };
  }, [reimbs.data]);

  const fTotals = useMemo(() => {
    const fs = fees.data?.fees ?? [];
    const total = fs.reduce((a: number, r: any) => a + r.amount_cents, 0);
    const paid = fs.filter((r: any) => r.status === "paid").reduce((a: number, r: any) => a + r.amount_cents, 0);
    return { total, paid, pending: total - paid };
  }, [fees.data]);

  const toggleReimb = async (rid: string, current: "pending" | "paid") => {
    await callStatus({ data: { id: rid, status: current === "paid" ? "pending" : "paid" } });
    qc.invalidateQueries({ queryKey: ["champ-staff-reimbs", id] });
    toast.success(current === "paid" ? "Marcado como pendente" : "Marcado como pago");
  };
  const toggleFee = async (fid: string, current: "pending" | "paid") => {
    await callFeeStatus({ data: { id: fid, status: current === "paid" ? "pending" : "paid" } });
    qc.invalidateQueries({ queryKey: ["champ-staff-fees", id] });
    toast.success(current === "paid" ? "Marcado como pendente" : "Marcado como pago");
  };
  const openReceipt = async (rid: string) => {
    const { url } = await callReceipt({ data: { reimbursement_id: rid } });
    if (url) window.open(url, "_blank"); else toast.error("Comprovante indisponível");
  };
  const openFeeReceipt = async (fid: string) => {
    const { url } = await callFeeReceipt({ data: { fee_id: fid } });
    if (url) window.open(url, "_blank"); else toast.error("Comprovante indisponível");
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await callExport({ data: { championship_id: id } });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Planilha gerada");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar planilha");
    } finally { setExporting(false); }
  };

  const StatBox = ({ label, value, tone }: { label: string; value: string; tone?: "success" | "warn" }) => (
    <Card className="p-3 bg-card/60">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone === "success" ? "text-success" : tone === "warn" ? "text-primary" : ""}`}>{value}</p>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-gradient-card border-border/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="paid">Pagos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Baixar Excel
        </Button>
      </Card>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Wallet className="size-5 text-primary" /> Cachês combinados</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <StatBox label="Total" value={brl(fTotals.total)} />
          <StatBox label="Pago" value={brl(fTotals.paid)} tone="success" />
          <StatBox label="Pendente" value={brl(fTotals.pending)} tone="warn" />
        </div>
        {fees.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
          : (fees.data?.fees ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum cachê lançado.</p>
          : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Staff</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">PIX</th>
                  <th className="py-2 pr-3 text-right">Valor</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {(fees.data!.fees as any[]).map((r) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="py-2 pr-3 font-medium">{r.staff?.name}</td>
                    <td className="py-2 pr-3 max-w-xs truncate" title={r.description}>{r.description || "—"}</td>
                    <td className="py-2 pr-3">
                      <button className="inline-flex items-center gap-1 hover:text-primary text-xs"
                        onClick={() => { navigator.clipboard.writeText(r.staff?.pix_key ?? ""); toast.success("PIX copiado"); }}>
                        <Copy className="size-3" /> {r.staff?.pix_key}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">{brl(r.amount_cents)}</td>
                    <td className="py-2 pr-3"><Badge variant={r.status === "paid" ? "default" : "secondary"}>{r.status === "paid" ? "Pago" : "Pendente"}</Badge></td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-1 justify-end">
                        {r.receipt_path && (
                          <Button size="sm" variant="ghost" onClick={() => openFeeReceipt(r.id)} title="Ver anexo">
                            <FileText className="size-4" />
                          </Button>
                        )}
                        <Button size="sm" variant={r.status === "paid" ? "outline" : "hero"} onClick={() => toggleFee(r.id, r.status)}>
                          {r.status === "paid" ? "Desfazer" : "Marcar pago"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-4">Reembolsos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <StatBox label="Total" value={brl(rTotals.total)} />
          <StatBox label="Pago" value={brl(rTotals.paid)} tone="success" />
          <StatBox label="Pendente" value={brl(rTotals.pending)} tone="warn" />
        </div>
        {reimbs.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
          : (reimbs.data?.reimbursements ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum reembolso encontrado.</p>
          : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Staff</th>
                  <th className="py-2 pr-3">Categoria</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">PIX</th>
                  <th className="py-2 pr-3 text-right">Valor</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {(reimbs.data!.reimbursements as any[]).map((r) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="py-2 pr-3 font-medium">{r.staff?.name}</td>
                    <td className="py-2 pr-3"><Badge variant="outline">{REIMB_CATEGORY_LABEL[r.category] ?? r.category}</Badge></td>
                    <td className="py-2 pr-3 max-w-xs truncate" title={r.description}>{r.description}</td>
                    <td className="py-2 pr-3">{new Date(r.expense_date).toLocaleDateString("pt-BR")}</td>
                    <td className="py-2 pr-3">
                      <button className="inline-flex items-center gap-1 hover:text-primary text-xs"
                        onClick={() => { navigator.clipboard.writeText(r.staff?.pix_key ?? ""); toast.success("PIX copiado"); }}>
                        <Copy className="size-3" /> {r.staff?.pix_key}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">{brl(r.amount_cents)}</td>
                    <td className="py-2 pr-3"><Badge variant={r.status === "paid" ? "default" : "secondary"}>{r.status === "paid" ? "Pago" : "Pendente"}</Badge></td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-1 justify-end">
                        {r.receipt_path && (
                          <Button size="sm" variant="ghost" onClick={() => openReceipt(r.id)} title="Ver comprovante">
                            <FileText className="size-4" />
                          </Button>
                        )}
                        <Button size="sm" variant={r.status === "paid" ? "outline" : "hero"} onClick={() => toggleReimb(r.id, r.status)}>
                          {r.status === "paid" ? "Desfazer" : "Marcar pago"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}


/* =================== CHAVES =================== */
function ChavesTab({ id }: { id: string }) {
  const callList = useServerFn(listBrackets);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["brackets-list-champ", id],
    queryFn: () => callList({ data: { championship_id: id } }),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Chaves deste campeonato</h2>
        <SimulateBracketDialog defaultChampionshipId={id} onCreated={refetch} />
        <CreateBracketDialog defaultChampionshipId={id} onCreated={refetch} />
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando…</div>
      ) : !data?.brackets.length ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhuma chave gerada. Clique em "Nova chave" acima.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.brackets.map((b: any) => {
            const cat = data.categories.find((c: any) => c.id === b.category_id);
            return (
              <Link key={b.id} to="/admin/chaves/$bracketId" params={{ bracketId: b.id }} className="block">
                <Card className="p-4 hover:border-primary/60 transition">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold truncate">{b.name}</h3>
                    <Badge variant={b.status === "finished" ? "default" : "secondary"}>{b.status === "finished" ? "Final" : "Live"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{cat?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.match_format === "best_of_3_tiebreak" ? "Melhor de 3" : "Set único"}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
