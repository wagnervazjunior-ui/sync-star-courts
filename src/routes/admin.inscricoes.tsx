import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, CheckCircle2, XCircle } from "lucide-react";
import ExcelJS from "exceljs";

export const Route = createFileRoute("/admin/inscricoes")({
  component: InscricoesPage,
});

const STATUS_LABEL: Record<string, string> = { pending: "Pendente", confirmed: "Confirmada", cancelled: "Cancelada" };

function InscricoesPage() {
  const qc = useQueryClient();
  const [championshipId, setChampionshipId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data: championships } = useQuery({
    queryKey: ["adm-championships"],
    queryFn: async () => (await supabase.from("championships").select("*").order("name")).data ?? [],
  });
  const { data: categories } = useQuery({
    queryKey: ["adm-categories"],
    queryFn: async () => (await supabase.from("categories").select("*, championship:championships(name, slug)").order("name")).data ?? [],
  });
  const { data: regs, isLoading } = useQuery({
    queryKey: ["adm-regs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("*, category:categories(name, price_cents, championship_id, championship:championships(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return (regs ?? []).filter((r: any) => {
      if (championshipId !== "all" && r.category?.championship_id !== championshipId) return false;
      if (categoryId !== "all" && r.category_id !== categoryId) return false;
      if (status !== "all" && r.status !== status) return false;
      if (search) {
        const s = search.toLowerCase();
        if (![r.voucher_code, r.contact_email, r.athlete1_name, r.athlete2_name].some(v => v?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [regs, championshipId, categoryId, status, search]);

  const filteredCategories = (categories ?? []).filter((c: any) => championshipId === "all" || c.championship_id === championshipId);

  const updateStatus = async (id: string, action: "confirm" | "cancel") => {
    const fn = action === "confirm" ? "confirm_registration" : "cancel_registration";
    const { error } = await supabase.rpc(fn, { _id: id });
    if (error) toast.error(error.message);
    else { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["adm-regs"] }); }
  };

  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Open Sync";
    const targetCh = championshipId === "all" ? null : championships?.find((c: any) => c.id === championshipId);
    const cats = (categories ?? []).filter((c: any) => !targetCh || c.championship_id === targetCh.id);

    const summary = wb.addWorksheet("Resumo");
    summary.columns = [
      { header: "Categoria", key: "cat", width: 30 },
      { header: "Pendentes", key: "p", width: 12 },
      { header: "Confirmadas", key: "c", width: 14 },
      { header: "Canceladas", key: "x", width: 14 },
      { header: "Total ativas", key: "t", width: 14 },
    ];

    for (const cat of cats) {
      const list = (regs ?? []).filter((r: any) => r.category_id === cat.id);
      const active = list.filter((r: any) => r.status !== "cancelled");
      const cancelled = list.filter((r: any) => r.status === "cancelled");
      const pending = list.filter((r: any) => r.status === "pending").length;
      const confirmed = list.filter((r: any) => r.status === "confirmed").length;
      summary.addRow({ cat: cat.name, p: pending, c: confirmed, x: cancelled.length, t: active.length });

      const makeSheet = (suffix: string, rows: any[]) => {
        const ws = wb.addWorksheet(`${cat.name} - ${suffix}`.slice(0, 31));
        ws.columns = [
          { header: "Voucher", key: "v", width: 12 },
          { header: "Status", key: "s", width: 12 },
          { header: "E-mail", key: "e", width: 28 },
          { header: "Atleta 1", key: "n1", width: 24 },
          { header: "Tel 1", key: "p1", width: 16 },
          { header: "Uniforme 1", key: "u1", width: 12 },
          { header: "Atleta 2", key: "n2", width: 24 },
          { header: "Tel 2", key: "p2", width: 16 },
          { header: "Uniforme 2", key: "u2", width: 12 },
          { header: "Data", key: "d", width: 18 },
        ];
        rows.forEach((r) => ws.addRow({
          v: r.voucher_code, s: STATUS_LABEL[r.status], e: r.contact_email,
          n1: r.athlete1_name, p1: r.athlete1_phone, u1: r.athlete1_shirt_size,
          n2: r.athlete2_name, p2: r.athlete2_phone, u2: r.athlete2_shirt_size,
          d: new Date(r.created_at).toLocaleString("pt-BR"),
        }));
        ws.getRow(1).font = { bold: true };
      };
      if (active.length) makeSheet("Ativas", active);
      if (cancelled.length) makeSheet("Canceladas", cancelled);
    }
    summary.getRow(1).font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscricoes-${targetCh?.slug ?? "todos"}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Inscrições</h1>
          <p className="text-muted-foreground">{filtered.length} resultado(s)</p>
        </div>
        <Button variant="hero" onClick={exportExcel}><Download className="size-4" /> Exportar Excel</Button>
      </div>

      <Card className="mt-4 p-4 bg-gradient-card border-border/50 grid gap-3 md:grid-cols-4">
        <Select value={championshipId} onValueChange={(v) => { setChampionshipId(v); setCategoryId("all"); }}>
          <SelectTrigger><SelectValue placeholder="Campeonato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os campeonatos</SelectItem>
            {championships?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {filteredCategories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
        <Input placeholder="Buscar voucher / nome / e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>

      <div className="mt-4 grid gap-3">
        {isLoading && <p className="text-muted-foreground">Carregando…</p>}
        {filtered.map((r: any) => (
          <Card key={r.id} className="p-4 bg-gradient-card border-border/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-bold text-primary">{r.voucher_code}</code>
                  <Badge variant={r.status === "confirmed" ? "default" : r.status === "cancelled" ? "destructive" : "secondary"}>{STATUS_LABEL[r.status]}</Badge>
                  <span className="text-xs text-muted-foreground">{r.category?.championship?.name} · {r.category?.name}</span>
                </div>
                <div className="mt-2 grid gap-1 text-sm md:grid-cols-2">
                  <div><strong>{r.athlete1_name}</strong> · {r.athlete1_phone} · uniforme {r.athlete1_shirt_size}</div>
                  <div><strong>{r.athlete2_name}</strong> · {r.athlete2_phone} · uniforme {r.athlete2_shirt_size}</div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.contact_email} · {new Date(r.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <div className="flex gap-1">
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
