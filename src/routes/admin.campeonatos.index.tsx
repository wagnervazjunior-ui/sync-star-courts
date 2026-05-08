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
import { Plus, Pencil, Trash2, Settings } from "lucide-react";

export const Route = createFileRoute("/admin/campeonatos/")({
  component: ChampionshipsPage,
});

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function ChampionshipsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["championships"],
    queryFn: async () => (await supabase.from("championships").select("*").order("created_at", { ascending: false })).data ?? [],
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

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campeonatos</h1>
          <p className="text-muted-foreground">Gerencie campeonatos. Crie um campeonato antes de adicionar categorias.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button variant="hero"><Plus className="size-4" /> Novo campeonato</Button>
          </DialogTrigger>
          <ChampionshipDialog initial={editing} onSave={save} />
        </Dialog>
      </div>

      <div className="mt-6 grid gap-4">
        {data?.map((c) => (
          <Card key={c.id} className="p-5 bg-gradient-card border-border/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold">{c.name}</h3>
                  <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Ativo" : "Inativo"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">/{c.slug}</p>
                {c.location && <p className="text-sm text-muted-foreground mt-1">{c.location}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="premium" asChild><Link to="/admin/campeonatos/$id" params={{ id: c.id }}><Settings className="size-4" /> Categorias</Link></Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="size-4 text-destructive" /></Button>
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
  const [form, setForm] = useState(() => initial ?? { name: "", slug: "", description: "", start_date: "", end_date: "", location: "", cover_image_url: "", active: true });
  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Editar" : "Novo"} campeonato</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-2"><Label>Slug (URL)</Label><Input placeholder="auto-gerado" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
        <div className="space-y-2"><Label>Descrição</Label><Textarea rows={4} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Início</Label><Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          <div className="space-y-2"><Label>Fim</Label><Input type="date" value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
        </div>
        <div className="space-y-2"><Label>Local</Label><Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
        <div className="space-y-2"><Label>URL da imagem de capa</Label><Input value={form.cover_image_url ?? ""} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} /></div>
        <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
      </div>
      <DialogFooter><Button variant="hero" onClick={() => onSave(form)}>Salvar</Button></DialogFooter>
    </DialogContent>
  );
}
