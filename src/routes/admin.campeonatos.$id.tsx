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
import { Plus, Pencil, Trash2, ArrowLeft, ExternalLink, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/campeonatos/$id")({
  component: ChampionshipDetail,
});

function ChampionshipDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: ch } = useQuery({
    queryKey: ["championship-admin", id],
    queryFn: async () => (await supabase.from("championships").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: cats } = useQuery({
    queryKey: ["categories", id],
    queryFn: async () => (await supabase.from("categories").select("*").eq("championship_id", id).order("name")).data ?? [],
  });

  const save = async (form: any) => {
    const payload = { ...form, championship_id: id, max_slots: Number(form.max_slots), price_cents: Math.round(Number(form.price_reais) * 100) };
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
      <Button variant="ghost" size="sm" asChild><Link to="/admin/campeonatos"><ArrowLeft className="size-4" /> Campeonatos</Link></Button>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{ch?.name}</h1>
          <p className="text-muted-foreground">Categorias do campeonato</p>
        </div>
        <div className="flex gap-2">
          {ch?.slug && (
            <Button variant="outline" asChild>
              <a href={`/campeonatos/${ch.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" /> Ver página pública
              </a>
            </Button>
          )}
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button variant="hero"><Plus className="size-4" /> Nova categoria</Button></DialogTrigger>
            <CategoryDialog initial={editing} onSave={save} />
          </Dialog>
        </div>
      </div>

      {ch && !ch.active && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          <AlertTriangle className="size-4 mt-0.5" />
          <span>Este campeonato está <strong>inativo</strong> e não aparece publicamente. Ative-o na lista de campeonatos para liberar inscrições.</span>
        </div>
      )}
      {ch?.active && cats && cats.length > 0 && cats.every((c: any) => !c.active) && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          <AlertTriangle className="size-4 mt-0.5" />
          <span>Nenhuma categoria está ativa. Ative pelo menos uma para que o público consiga se inscrever.</span>
        </div>
      )}

      <div className="mt-6 grid gap-3">
        {cats?.map((c) => (
          <Card key={c.id} className="p-5 bg-gradient-card border-border/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold">{c.name}</h3>
                  <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Ativa" : "Inativa"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{c.max_slots} vagas · R$ {(c.price_cents / 100).toFixed(2).replace(".", ",")}</p>
                {c.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line line-clamp-2">{c.description}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditing({ ...c, price_reais: (c.price_cents / 100).toFixed(2) }); setOpen(true); }}><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          </Card>
        ))}
        {cats?.length === 0 && <Card className="p-8 text-center text-muted-foreground bg-gradient-card border-border/50">Nenhuma categoria criada.</Card>}
      </div>
    </div>
  );
}

function CategoryDialog({ initial, onSave }: { initial: any; onSave: (v: any) => void }) {
  const [form, setForm] = useState(() => initial ?? { name: "", description: "", max_slots: 16, price_reais: "0", active: true });
  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Editar" : "Nova"} categoria</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Iniciante Masculino" /></div>
        <div className="space-y-2"><Label>Descrição (premiação, regras, horário)</Label><Textarea rows={5} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Vagas</Label><Input type="number" min={1} value={form.max_slots} onChange={(e) => setForm({ ...form, max_slots: e.target.value })} /></div>
          <div className="space-y-2"><Label>Preço (R$)</Label><Input type="number" step="0.01" value={form.price_reais} onChange={(e) => setForm({ ...form, price_reais: e.target.value })} /></div>
        </div>
        <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativa</Label></div>
      </div>
      <DialogFooter><Button variant="hero" onClick={() => onSave(form)}>Salvar</Button></DialogFooter>
    </DialogContent>
  );
}
