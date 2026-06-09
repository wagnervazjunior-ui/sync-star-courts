import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Copy, Download, Loader2, Mail, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { Switch as SwitchUI } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  listPrizes, createPrizeManual, resendPrizeEmail, deletePrize, payPrize, exportPrizesXlsx, adminFillPrizeData,
} from "@/lib/prizes.functions";
import { listManageableChampionships } from "@/lib/staff.functions";
import { AdminPinDialog } from "@/components/AdminPinDialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/premiacoes")({
  head: () => ({ meta: [{ title: "Premiações — Admin Open Sync" }] }),
  component: PremiacoesPage,
});

const PLACEMENT_LABEL: Record<number, string> = { 1: "1º lugar", 2: "2º lugar", 3: "3º lugar" };
const STATUS_LABEL: Record<string, string> = { pending: "Aguardando", registered: "Dados OK", paid: "Pago", cancelled: "Cancelado" };
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary", registered: "outline", paid: "default", cancelled: "destructive",
};

function brl(c: number) { return "R$ " + (c / 100).toFixed(2).replace(".", ","); }
function getSiteUrl() { return typeof window !== "undefined" ? window.location.origin : "https://www.opensync.com.br"; }

function PremiacoesPage() {
  const qc = useQueryClient();
  const [championshipId, setChampionshipId] = useState("");
  const [newPrizeOpen, setNewPrizeOpen] = useState(false);
  const [payDialog, setPayDialog] = useState<{ id: string; teamName: string; placement: number } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [pinDialog, setPinDialog] = useState<{ title: string; description: string; action: () => Promise<void> } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [fillDialog, setFillDialog] = useState<any | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");

  const callChamps = useServerFn(listManageableChampionships);
  const callList = useServerFn(listPrizes);
  const callDelete = useServerFn(deletePrize);
  const callResend = useServerFn(resendPrizeEmail);
  const callPay = useServerFn(payPrize);
  const callExport = useServerFn(exportPrizesXlsx);

  const champs = useQuery({ queryKey: ["premiacoes-champs"], queryFn: () => callChamps() });
  const prizes = useQuery({
    queryKey: ["premiacoes-list", championshipId],
    queryFn: () => callList({ data: { championship_id: championshipId } }),
    enabled: !!championshipId,
  });

  const handleDelete = async (id: string, teamName: string) => {
    if (!confirm(`Excluir premiação de "${teamName}"?`)) return;
    try { await callDelete({ data: { prize_id: id } }); toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["premiacoes-list"] }); }
    catch (e: any) { toast.error(e?.message ?? "Erro"); }
  };

  const handleResend = async (id: string) => {
    try { await callResend({ data: { prize_id: id } }); toast.success("Email reenviado"); }
    catch (e: any) { toast.error(e?.message ?? "Erro ao reenviar"); }
  };

  const handlePay = (prize: any) => {
    setPayAmount("");
    setPayDialog({ id: prize.id, teamName: prize.team_name, placement: prize.placement });
  };

  const confirmPay = () => {
    const cents = Math.round(parseFloat(payAmount.replace(",", ".")) * 100);
    if (!cents || cents <= 0) { toast.error("Valor inválido"); return; }
    const snapshot = { id: payDialog!.id, teamName: payDialog!.teamName, placement: payDialog!.placement, cents };
    setPayDialog(null);
    setPinDialog({
      title: "Confirmar pagamento de premiação",
      description: `Pagar ${brl(cents)} para ${snapshot.teamName} (${PLACEMENT_LABEL[snapshot.placement]}) via PIX`,
      action: async () => {
        await callPay({ data: { prize_id: snapshot.id, amount_cents: snapshot.cents } });
        toast.success("PIX enviado!");
        qc.invalidateQueries({ queryKey: ["premiacoes-list"] });
      },
    });
  };

  const handleExport = async () => {
    if (!championshipId) return;
    setExporting(true);
    try {
      const res = await callExport({ data: { championship_id: championshipId } });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "premiacoes.xlsx";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) { toast.error(e?.message ?? "Erro ao exportar"); }
    finally { setExporting(false); }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${getSiteUrl()}/premiacao/cadastro/${token}`);
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="size-7 text-primary" /> Premiações</h1>
          <p className="text-sm text-muted-foreground">Gerencie pagamentos de premiação em dinheiro.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!championshipId || exporting}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Excel
          </Button>
          <Button variant="hero" onClick={() => setNewPrizeOpen(true)} disabled={!championshipId}>
            <Plus className="size-4" /> Cadastrar manualmente
          </Button>
        </div>
      </div>

      <div className="max-w-sm">
        <Label>Campeonato</Label>
        <Select value={championshipId} onValueChange={setChampionshipId}>
          <SelectTrigger><SelectValue placeholder="Selecione o campeonato" /></SelectTrigger>
          <SelectContent>
            {(champs.data?.championships ?? []).map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {championshipId && !prizes.isLoading && (prizes.data?.prizes ?? []).length > 0 && (
        <div className="max-w-xs">
          <Label>Filtrar por categoria</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {Array.from(new Map((prizes.data?.prizes ?? []).map((p: any) => [p.category_id, p.category?.name])).entries()).map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {championshipId && (
        prizes.isLoading ? <p className="text-muted-foreground"><Loader2 className="size-4 animate-spin inline mr-2" />Carregando…</p>
        : (prizes.data?.prizes ?? []).length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Nenhuma premiação cadastrada para este campeonato.</Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Categoria</th>
                  <th className="py-2 pr-3">Colocação</th>
                  <th className="py-2 pr-3">Dupla</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Recebedor(es)</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Link de cadastro</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {(prizes.data!.prizes as any[]).filter((p) => filterCategory === "all" || p.category_id === filterCategory).map((p) => (
                  <tr key={p.id} className="border-t border-border/40">
                    <td className="py-2 pr-3 text-muted-foreground">{p.category?.name}</td>
                    <td className="py-2 pr-3 font-medium">{PLACEMENT_LABEL[p.placement] ?? `${p.placement}º`}</td>
                    <td className="py-2 pr-3">{p.team_name}</td>
                    <td className="py-2 pr-3"><Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>{STATUS_LABEL[p.status] ?? p.status}</Badge></td>
                    <td className="py-2 pr-3 text-xs">
                      {p.recipient1_name ? (
                        <span>{p.recipient1_name} ({p.recipient1_pix_type}: {p.recipient1_pix_key}){p.split_payment && p.recipient2_name ? ` + ${p.recipient2_name}` : ""}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 pr-3">{p.amount_cents != null ? brl(p.amount_cents) : "—"}</td>
                    <td className="py-2 pr-3">
                      <Button size="sm" variant="ghost" onClick={() => copyLink(p.token)} title="Copiar link">
                        <Copy className="size-3.5" />
                      </Button>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-1 justify-end">
                        {p.status !== "paid" && (
                          <Button size="sm" variant="outline" onClick={() => setFillDialog(p)} title="Preencher dados da dupla">
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                        {p.contact_email && p.status !== "paid" && (
                          <Button size="sm" variant="ghost" onClick={() => handleResend(p.id)} title="Reenviar email">
                            <Mail className="size-4" />
                          </Button>
                        )}
                        {p.status === "registered" && (
                          <Button size="sm" variant="hero" onClick={() => handlePay(p)} title="Pagar via PIX">
                            💸 PIX
                          </Button>
                        )}
                        {p.status !== "paid" && (
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(p.id, p.team_name)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Dialog: valor do pagamento */}
      <Dialog open={!!payDialog} onOpenChange={(o) => { if (!o) setPayDialog(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Valor da premiação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{payDialog?.teamName} — {PLACEMENT_LABEL[payDialog?.placement ?? 1]}</p>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0,00" inputMode="decimal" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancelar</Button>
            <Button variant="hero" onClick={confirmPay}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: preencher dados da dupla pelo admin */}
      <FillPrizeDialog
        open={!!fillDialog}
        prize={fillDialog}
        onOpenChange={(v) => { if (!v) setFillDialog(null); }}
        onSaved={() => { setFillDialog(null); qc.invalidateQueries({ queryKey: ["premiacoes-list"] }); }}
      />

      {/* Dialog: cadastro manual */}
      <NewPrizeDialog
        open={newPrizeOpen}
        onOpenChange={setNewPrizeOpen}
        championshipId={championshipId}
        onCreated={(token) => {
          qc.invalidateQueries({ queryKey: ["premiacoes-list"] });
          navigator.clipboard.writeText(`${getSiteUrl()}/premiacao/cadastro/${token}`);
          toast.success("Premiação criada — link copiado!");
        }}
      />

      <AdminPinDialog
        open={!!pinDialog}
        onOpenChange={(open) => { if (!open) setPinDialog(null); }}
        title={pinDialog?.title ?? ""}
        description={pinDialog?.description}
        onConfirmed={async () => {
          try { await pinDialog?.action(); }
          catch (e: any) { toast.error(e?.message ?? "Falha ao pagar"); }
          finally { setPinDialog(null); }
        }}
      />
    </div>
  );
}

function NewPrizeDialog({ open, onOpenChange, championshipId, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; championshipId: string; onCreated: (token: string) => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [placement, setPlacement] = useState("1");
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const callCreate = useServerFn(createPrizeManual);

  const { data: cats } = useQuery({
    queryKey: ["premiacoes-cats", championshipId],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").eq("championship_id", championshipId);
      return data ?? [];
    },
    enabled: open && !!championshipId,
  });

  const reset = () => { setCategoryId(""); setPlacement("1"); setTeamName(""); setEmail(""); };

  const submit = async () => {
    if (!categoryId || !teamName.trim()) { toast.error("Preencha categoria e nome da dupla"); return; }
    setSaving(true);
    try {
      const res = await callCreate({ data: { category_id: categoryId, championship_id: championshipId, placement: parseInt(placement), team_name: teamName, contact_email: email || undefined } });
      reset();
      onOpenChange(false);
      onCreated(res.token);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cadastrar premiação manualmente</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{(cats ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Colocação</Label>
            <Select value={placement} onValueChange={setPlacement}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1º lugar</SelectItem>
                <SelectItem value="2">2º lugar</SelectItem>
                <SelectItem value="3">3º lugar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nome da dupla</Label>
            <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Ex: João e Maria" />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail para envio do link (opcional)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dupla@email.com" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="hero" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null} Criar e copiar link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PIX_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
];

function FillPrizeDialog({ open, prize, onOpenChange, onSaved }: {
  open: boolean; prize: any; onOpenChange: (v: boolean) => void; onSaved: () => void;
}) {
  const [r1Name, setR1Name] = useState("");
  const [r1Key, setR1Key] = useState("");
  const [r1Type, setR1Type] = useState("cpf");
  const [split, setSplit] = useState(false);
  const [r2Name, setR2Name] = useState("");
  const [r2Key, setR2Key] = useState("");
  const [r2Type, setR2Type] = useState("cpf");
  const [saving, setSaving] = useState(false);
  const callFill = useServerFn(adminFillPrizeData);

  useEffect(() => {
    if (prize) {
      setR1Name(prize.recipient1_name ?? "");
      setR1Key(prize.recipient1_pix_key ?? "");
      setR1Type(prize.recipient1_pix_type ?? "cpf");
      setSplit(!!prize.split_payment);
      setR2Name(prize.recipient2_name ?? "");
      setR2Key(prize.recipient2_pix_key ?? "");
      setR2Type(prize.recipient2_pix_type ?? "cpf");
    }
  }, [prize]);

  const submit = async () => {
    if (!r1Name.trim() || !r1Key.trim()) { toast.error("Preencha nome e chave PIX do recebedor"); return; }
    if (split && (!r2Name.trim() || !r2Key.trim())) { toast.error("Preencha os dados do 2º recebedor"); return; }
    setSaving(true);
    try {
      await callFill({
        data: {
          prize_id: prize.id,
          recipient1_name: r1Name,
          recipient1_pix_key: r1Key,
          recipient1_pix_type: r1Type as any,
          split_payment: split,
          recipient2_name: split ? r2Name : undefined,
          recipient2_pix_key: split ? r2Key : undefined,
          recipient2_pix_type: split ? r2Type as any : undefined,
        },
      });
      toast.success("Dados salvos");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dados bancários — {prize?.team_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-primary/10 text-sm">
            <span className="font-medium text-primary">{PLACEMENT_LABEL[prize?.placement] ?? ""}</span>
            {" · "}{prize?.category?.name}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recebedor</p>
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={r1Name} onChange={(e) => setR1Name(e.target.value)} placeholder="Nome de quem receberá" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Tipo PIX</Label>
                <Select value={r1Type} onValueChange={setR1Type}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PIX_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Chave PIX</Label>
                <Input value={r1Key} onChange={(e) => setR1Key(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SwitchUI checked={split} onCheckedChange={setSplit} id="fill-split" />
            <Label htmlFor="fill-split" className="cursor-pointer">Dividir entre os dois jogadores (50% cada)</Label>
          </div>

          {split && (
            <div className="space-y-3 pl-4 border-l-2 border-primary/30">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">2º Recebedor</p>
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input value={r2Name} onChange={(e) => setR2Name(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Tipo PIX</Label>
                  <Select value={r2Type} onValueChange={setR2Type}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PIX_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Chave PIX</Label>
                  <Input value={r2Key} onChange={(e) => setR2Key(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button variant="hero" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null} Salvar dados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
