import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { confirmRegistrationManually, refundRegistration } from "@/lib/payments.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RotateCcw, CreditCard, QrCode } from "lucide-react";
import { AdminPinDialog } from "@/components/AdminPinDialog";

const PAYMENT_METHOD_LABEL: Record<string, { label: string; icon: React.ReactNode }> = {
  pix:         { label: "PIX",           icon: <QrCode className="size-3" /> },
  credit_card: { label: "Cartão",        icon: <CreditCard className="size-3" /> },
  cash:        { label: "Dinheiro",      icon: null },
};

function brl(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export const Route = createFileRoute("/admin/inscricoes")({
  component: InscricoesPage,
});

const STATUS_LABEL: Record<string, string> = { pending: "Pendente", confirmed: "Confirmada", cancelled: "Cancelada" };
const REASON_LABEL: Record<string, string> = {
  cash: "Pagamento em dinheiro",
  sponsor: "Patrocinador",
  courtesy: "Vaga cortesia",
  other: "Outro",
};

type Reason = "cash" | "sponsor" | "courtesy" | "other";

function InscricoesPage() {
  const qc = useQueryClient();
  const [championshipId, setChampionshipId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const [confirmDialog, setConfirmDialog] = useState<{ id: string; voucher: string } | null>(null);
  const [reason, setReason] = useState<Reason>("cash");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pinDialog, setPinDialog] = useState<{ title: string; description: string; action: () => Promise<void> } | null>(null);

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
      // Fields used: payment_method, confirmed_at, amount_cents, installments, asaas_payment_id
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
        if (![r.voucher_code, r.contact_email, r.team_name, r.athlete1_name, r.athlete2_name].some((v: any) => v?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [regs, championshipId, categoryId, status, search]);

  const filteredCategories = (categories ?? []).filter((c: any) => championshipId === "all" || c.championship_id === championshipId);

  const callConfirmManually = useServerFn(confirmRegistrationManually);
  const callRefund = useServerFn(refundRegistration);

  const handleRefund = (id: string, voucher: string, amountCents: number) => {
    setPinDialog({
      title: "Confirmar estorno",
      description: `Estornar inscrição ${voucher} (${brl(amountCents)})? O valor será devolvido ao pagador e a inscrição cancelada.`,
      action: async () => {
        await callRefund({ data: { registration_id: id } });
        toast.success(`Estorno realizado — ${brl(amountCents)} devolvidos`);
        qc.invalidateQueries({ queryKey: ["adm-regs"] });
      },
    });
  };

  const openConfirmDialog = (id: string, voucher: string) => {
    setReason("cash");
    setNote("");
    setConfirmDialog({ id, voucher });
  };

  const submitConfirm = () => {
    if (!confirmDialog) return;
    if (reason === "other" && !note.trim()) {
      toast.error("Descreva o motivo no campo de observação");
      return;
    }
    const snapshot = { id: confirmDialog.id, reason, note: note.trim() || undefined };
    setConfirmDialog(null);
    setPinDialog({
      title: "Confirmar inscrição manual",
      description: `Confirmar inscrição ${snapshot.id.slice(0, 8)}… sem pagamento via Asaas`,
      action: async () => {
        setSubmitting(true);
        try {
          await callConfirmManually({ data: { registrationId: snapshot.id, reason: snapshot.reason, note: snapshot.note } });
          toast.success("Inscrição confirmada (e-mail enviado)");
          qc.invalidateQueries({ queryKey: ["adm-regs"] });
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const cancelRegistration = async (id: string) => {
    const { error } = await supabase.rpc("cancel_registration", { _id: id });
    if (error) toast.error(error.message);
    else { toast.success("Inscrição cancelada"); qc.invalidateQueries({ queryKey: ["adm-regs"] }); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Inscrições</h1>
          <p className="text-muted-foreground">{filtered.length} resultado(s)</p>
        </div>
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
        <Input placeholder="Buscar voucher / dupla / e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  {r.manual_confirmation_reason && (
                    <Badge variant="outline" title={r.manual_confirmation_note ?? undefined}>
                      {REASON_LABEL[r.manual_confirmation_reason] ?? r.manual_confirmation_reason}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{r.category?.championship?.name} · {r.category?.name}</span>
                </div>
                <p className="mt-1 text-sm font-medium">{r.team_name} · {r.contact_phone}</p>
                <div className="mt-1 grid gap-1 text-sm md:grid-cols-2">
                  <div><strong>{r.athlete1_name}</strong> · cam {r.athlete1_shirt_size} / short {r.athlete1_shorts_size}</div>
                  <div><strong>{r.athlete2_name}</strong> · cam {r.athlete2_shirt_size} / short {r.athlete2_shorts_size}</div>
                </div>
                {r.manual_confirmation_note && (
                  <p className="mt-1 text-xs italic text-muted-foreground">Obs.: {r.manual_confirmation_note}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{r.contact_email} · {new Date(r.created_at).toLocaleString("pt-BR")}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  {r.amount_cents > 0 && (
                    <span className="font-semibold text-foreground/80">{brl(r.amount_cents)}{r.installments > 1 ? ` (${r.installments}x)` : ""}</span>
                  )}
                  {r.payment_method && (() => {
                    const pm = PAYMENT_METHOD_LABEL[r.payment_method];
                    return pm ? (
                      <span className="flex items-center gap-1">{pm.icon}{pm.label}</span>
                    ) : <span>{r.payment_method}</span>;
                  })()}
                  {r.confirmed_at && (
                    <span>Confirmado em {new Date(r.confirmed_at).toLocaleString("pt-BR")}</span>
                  )}
                </div>
                {r.terms_accepted_at && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Termo aceito em {new Date(r.terms_accepted_at).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" asChild><Link to="/admin/categorias/$categoryId" params={{ categoryId: r.category_id }}>Abrir categoria</Link></Button>
                {r.status !== "confirmed" && (
                  <Button size="sm" variant="premium" onClick={() => openConfirmDialog(r.id, r.voucher_code)}>
                    <CheckCircle2 className="size-4" />
                  </Button>
                )}
                {r.status === "confirmed" && r.asaas_payment_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    title="Estornar pagamento"
                    onClick={() => handleRefund(r.id, r.voucher_code, r.amount_cents)}
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                )}
                {r.status !== "cancelled" && (
                  <Button size="sm" variant="ghost" onClick={() => cancelRegistration(r.id)}>
                    <XCircle className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && <Card className="p-8 text-center text-muted-foreground bg-gradient-card border-border/50">Nenhuma inscrição encontrada.</Card>}
      </div>

      <Dialog open={!!confirmDialog} onOpenChange={(o) => !o && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar inscrição</DialogTitle>
            <DialogDescription>
              {confirmDialog && <>Voucher <code className="font-bold text-primary">{confirmDialog.voucher}</code>. Selecione o motivo da confirmação manual.</>}
            </DialogDescription>
          </DialogHeader>

          <RadioGroup value={reason} onValueChange={(v) => setReason(v as Reason)} className="grid gap-2 mt-2">
            {(["cash", "sponsor", "courtesy", "other"] as Reason[]).map((opt) => (
              <Label
                key={opt}
                htmlFor={`reason-${opt}`}
                className="flex items-center gap-3 rounded-md border border-border/50 p-3 cursor-pointer hover:bg-muted/40"
              >
                <RadioGroupItem id={`reason-${opt}`} value={opt} />
                <span>{REASON_LABEL[opt]}</span>
              </Label>
            ))}
          </RadioGroup>

          <div className="mt-2">
            <Label htmlFor="confirm-note" className="text-xs uppercase tracking-widest text-muted-foreground">
              Observação {reason === "other" ? "(obrigatório)" : "(opcional)"}
            </Label>
            <Textarea
              id="confirm-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: pago no PIX direto, patrocínio Acme, etc."
              className="mt-1"
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialog(null)} disabled={submitting}>Cancelar</Button>
            <Button variant="premium" onClick={submitConfirm} disabled={submitting}>
              {submitting ? "Confirmando…" : "Confirmar e enviar e-mail"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminPinDialog
        open={!!pinDialog}
        onOpenChange={(open) => { if (!open) setPinDialog(null); }}
        title={pinDialog?.title ?? ""}
        description={pinDialog?.description}
        onConfirmed={async () => {
          try {
            await pinDialog?.action();
          } catch (e: any) {
            toast.error(e?.message ?? "Falha ao executar operação");
          } finally {
            setPinDialog(null);
          }
        }}
      />
    </div>
  );
}
