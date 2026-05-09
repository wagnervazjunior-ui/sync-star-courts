import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle, Users, Download, ClipboardList, Pencil } from "lucide-react";
import { generateUniformWorkbook } from "@/lib/uniform-export";
import { generateGateListWorkbook } from "@/lib/gate-list-export";

const SHIRT_SIZES = ["P", "M", "G", "GG", "XG"] as const;
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export const Route = createFileRoute("/admin/categorias/$categoryId")({
  component: CategoryAdminPage,
});

const STATUS_LABEL: Record<string, string> = { pending: "Pendente", confirmed: "Confirmada", cancelled: "Cancelada" };
const GENDER_LABEL: Record<string, string> = { male: "Masculina", female: "Feminina", mixed: "Mista" };

function CategoryAdminPage() {
  const { categoryId } = Route.useParams();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);

  const { data: cat } = useQuery({
    queryKey: ["adm-cat", categoryId],
    queryFn: async () => (await supabase.from("categories").select("*, championship:championships(*)").eq("id", categoryId).maybeSingle()).data,
  });

  const { data: regs } = useQuery({
    queryKey: ["adm-cat-regs", categoryId],
    queryFn: async () => (await supabase.from("registrations").select("*").eq("category_id", categoryId).order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = useMemo(() => {
    if (!regs) return [];
    if (!search) return regs;
    const s = search.toLowerCase();
    return regs.filter((r: any) =>
      [r.voucher_code, r.team_name, r.contact_email, r.contact_phone, r.athlete1_name, r.athlete2_name].some((v) => v?.toLowerCase().includes(s))
    );
  }, [regs, search]);

  const totalAtivas = (regs ?? []).filter((r: any) => r.status !== "cancelled").length;
  const restantes = cat ? Math.max(0, cat.max_slots - totalAtivas) : 0;

  const updateStatus = async (id: string, action: "confirm" | "cancel") => {
    const fn = action === "confirm" ? "confirm_registration" : "cancel_registration";
    const { error } = await supabase.rpc(fn, { _id: id });
    if (error) toast.error(error.message);
    else { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["adm-cat-regs", categoryId] }); }
  };

  const exportExcel = async () => {
    if (!cat) return;
    const confirmed = (regs ?? []).filter((r: any) => r.status === "confirmed");
    if (!confirmed.length) { toast.info("Nenhuma inscrição confirmada para exportar"); return; }
    await generateUniformWorkbook({
      championshipName: cat.championship?.name ?? "",
      championshipSlug: cat.championship?.slug ?? "categoria",
      categories: [{ ...cat, registrations: confirmed }],
    });
  };

  const exportGateList = async () => {
    if (!cat) return;
    await generateGateListWorkbook({
      championshipName: cat.championship?.name ?? "",
      championshipSlug: `${cat.championship?.slug ?? "categoria"}-${cat.name}`,
      categories: [{ name: cat.name, registrations: regs ?? [] }],
    });
  };

  return (
    <div>
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/campeonatos/$id" params={{ id: cat?.championship_id ?? "" }}><ArrowLeft className="size-4" /> Voltar</Link>
      </Button>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{cat?.championship?.name}</p>
          <h1 className="text-3xl font-bold">{cat?.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {cat?.gender && <Badge variant="outline">{GENDER_LABEL[cat.gender] ?? cat.gender}</Badge>}
            {cat?.uniform_model && <Badge variant="outline">{cat.uniform_model}</Badge>}
            <Badge variant="secondary" className="gap-1"><Users className="size-3" /> {totalAtivas}/{cat?.max_slots ?? 0} inscritos · {restantes} vaga(s)</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportGateList}><ClipboardList className="size-4" /> Lista da portaria</Button>
          <Button variant="hero" onClick={exportExcel}><Download className="size-4" /> Planilha de uniformes</Button>
        </div>
      </div>

      <Card className="mt-6 p-4 bg-gradient-card border-border/50">
        <Input placeholder="Buscar voucher / dupla / atleta / e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>

      <Card className="mt-4 bg-gradient-card border-border/50 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voucher</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dupla</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Atleta 1 (cam/short)</TableHead>
              <TableHead>Atleta 2 (cam/short)</TableHead>
              <TableHead>Data</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell><code className="font-bold text-primary">{r.voucher_code}</code></TableCell>
                <TableCell>
                  <Badge variant={r.status === "confirmed" ? "default" : r.status === "cancelled" ? "destructive" : "secondary"}>{STATUS_LABEL[r.status]}</Badge>
                </TableCell>
                <TableCell className="font-medium">{r.team_name}</TableCell>
                <TableCell>{r.contact_phone}</TableCell>
                <TableCell className="text-xs">{r.contact_email}</TableCell>
                <TableCell className="text-sm">{r.athlete1_name}<br /><span className="text-xs text-muted-foreground">{r.athlete1_shirt_size} / {r.athlete1_shorts_size}</span></TableCell>
                <TableCell className="text-sm">{r.athlete2_name}<br /><span className="text-xs text-muted-foreground">{r.athlete2_shirt_size} / {r.athlete2_shorts_size}</span></TableCell>
                <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" title="Editar inscrição" onClick={() => setEditing(r)}><Pencil className="size-4" /></Button>
                    {r.status !== "confirmed" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="premium" title="Confirmar inscrição"><CheckCircle2 className="size-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar inscrição?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Voucher <strong>{r.voucher_code}</strong> — dupla "{r.team_name || "—"}". A inscrição passará para confirmada.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => updateStatus(r.id, "confirm")}>Confirmar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {r.status !== "cancelled" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" title="Cancelar inscrição"><XCircle className="size-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancelar inscrição?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Voucher <strong>{r.voucher_code}</strong> — dupla "{r.team_name || "—"}". A inscrição será cancelada e a vaga liberada.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => updateStatus(r.id, "cancel")}>Cancelar inscrição</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma inscrição.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
