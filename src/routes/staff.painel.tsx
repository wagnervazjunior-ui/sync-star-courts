import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createReceiptUploadUrl,
  createReimbursement,
  getStaffMe,
  listMyFees,
  listMyReimbursements,
  listStaffChampionships,
  staffLogout,
  updateStaffPix,
  upsertMyFee,
  getMyReceiptSignedUrl,
  getMyFeeReceiptSignedUrl,
} from "@/lib/staff.functions";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, LogOut, Plus, Receipt, Wallet, Pencil, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/painel")({
  head: () => ({ meta: [{ title: "Painel do Staff — Open Sync" }] }),
  component: StaffPanel,
});

const CATEGORY_LABEL: Record<string, string> = {
  alimentacao: "Alimentação",
  transporte: "Transporte",
  passagem: "Passagem",
  gasolina: "Gasolina",
  hospedagem: "Hospedagem",
  outro: "Outro",
};

function brl(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function StaffPanel() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const callMe = useServerFn(getStaffMe);
  const callLogout = useServerFn(staffLogout);

  const me = useQuery({ queryKey: ["staff-me"], queryFn: () => callMe() });

  useEffect(() => {
    if (me.isSuccess && !me.data?.staff) nav({ to: "/staff/login" });
  }, [me.isSuccess, me.data, nav]);

  const callChamp = useServerFn(listStaffChampionships);
  const callList = useServerFn(listMyReimbursements);

  const champs = useQuery({
    queryKey: ["staff-championships"],
    queryFn: () => callChamp(),
    enabled: !!me.data?.staff,
  });
  const callListFees = useServerFn(listMyFees);
  const fees = useQuery({
    queryKey: ["staff-fees"],
    queryFn: () => callListFees(),
    enabled: !!me.data?.staff,
  });
  const reimbs = useQuery({
    queryKey: ["staff-reimbursements"],
    queryFn: () => callList(),
    enabled: !!me.data?.staff,
  });

  const totals = useMemo(() => {
    const rs = reimbs.data?.reimbursements ?? [];
    const total = rs.reduce((a, r: any) => a + r.amount_cents, 0);
    const paid = rs.filter((r: any) => r.status === "paid").reduce((a, r: any) => a + r.amount_cents, 0);
    return { total, paid, pending: total - paid, count: rs.length };
  }, [reimbs.data]);

  if (me.isLoading || !me.data?.staff) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const staff = me.data.staff;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 h-16">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-muted-foreground">Olá, {staff.name.split(" ")[0]}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await callLogout();
                qc.clear();
                nav({ to: "/staff/login" });
              }}
            >
              <LogOut className="size-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Profile card */}
        <Card className="p-6 bg-gradient-card border-border/50">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Staff</p>
              <h1 className="text-2xl font-bold">{staff.name}</h1>
              <div className="mt-2 text-sm text-muted-foreground space-y-0.5">
                <p>CPF: {staff.cpf}</p>
                <p>
                  PIX ({staff.pix_key_type.toUpperCase()}): <span className="text-foreground font-medium">{staff.pix_key}</span>
                </p>
              </div>
            </div>
            <EditPixDialog
              current={{ pix_key_type: staff.pix_key_type as any, pix_key: staff.pix_key }}
              onSaved={() => qc.invalidateQueries({ queryKey: ["staff-me"] })}
            />
          </div>
        </Card>

        {/* Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Total lançado" value={brl(totals.total)} />
          <StatCard label="Pago" value={brl(totals.paid)} tone="success" />
          <StatCard label="Pendente" value={brl(totals.pending)} tone="warn" />
        </div>

        {/* Reimbursements */}
        <Card className="p-6 bg-gradient-card border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Receipt className="size-5 text-primary" /> Meus reembolsos
            </h2>
            <NewReimbursementDialog
              championships={champs.data?.championships ?? []}
              onCreated={() => qc.invalidateQueries({ queryKey: ["staff-reimbursements"] })}
            />
          </div>

          {reimbs.isLoading ? (
            <p className="py-8 text-center text-muted-foreground"><Loader2 className="size-5 mx-auto animate-spin" /></p>
          ) : (reimbs.data?.reimbursements ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum reembolso lançado ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {(reimbs.data!.reimbursements as any[]).map((r) => (
                <ReimbursementRow key={r.id} r={r} />
              ))}
            </div>
          )}
        </Card>

        {/* Fees / Cachês */}
        <Card className="p-6 bg-gradient-card border-border/50">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Wallet className="size-5 text-primary" /> Cachês combinados
            </h2>
            <NewFeeDialog
              championships={champs.data?.championships ?? []}
              onSaved={() => qc.invalidateQueries({ queryKey: ["staff-fees"] })}
            />
          </div>
          {fees.isLoading ? (
            <p className="py-8 text-center text-muted-foreground"><Loader2 className="size-5 mx-auto animate-spin" /></p>
          ) : (fees.data?.fees ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum cachê lançado ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {(fees.data!.fees as any[]).map((r) => (
                <FeeRow key={r.id} r={r} />
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "warn" }) {
  return (
    <Card className="p-4 bg-gradient-card border-border/50">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          tone === "success" ? "text-success" : tone === "warn" ? "text-primary" : ""
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

function ReimbursementRow({ r }: { r: any }) {
  const callReceipt = useServerFn(getMyReceiptSignedUrl);
  const openReceipt = async () => {
    const { url } = await callReceipt({ data: { reimbursement_id: r.id } });
    if (url) window.open(url, "_blank");
    else toast.error("Comprovante indisponível");
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{CATEGORY_LABEL[r.category] ?? r.category}</Badge>
          <Badge variant={r.status === "paid" ? "default" : "secondary"}>
            {r.status === "paid" ? "Pago" : "Pendente"}
          </Badge>
          <span className="text-xs text-muted-foreground">{r.championship?.name}</span>
        </div>
        <p className="mt-1 text-sm truncate">{r.description}</p>
        <p className="text-xs text-muted-foreground">
          Data da despesa: {new Date(r.expense_date).toLocaleDateString("pt-BR")}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {r.receipt_path && (
          <Button size="sm" variant="ghost" onClick={openReceipt} title="Ver comprovante">
            <FileText className="size-4" />
          </Button>
        )}
        <p className="font-semibold">{brl(r.amount_cents)}</p>
      </div>
    </div>
  );
}

function EditPixDialog({
  current,
  onSaved,
}: {
  current: { pix_key_type: "cpf" | "email" | "phone" | "random"; pix_key: string };
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(current.pix_key_type);
  const [key, setKey] = useState(current.pix_key);
  const [saving, setSaving] = useState(false);
  const call = useServerFn(updateStaffPix);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil className="size-4" /> Editar PIX</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Atualizar chave PIX</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="random">Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Chave</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
          <Button
            variant="hero"
            className="w-full"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await call({ data: { pix_key_type: type, pix_key: key } });
                toast.success("PIX atualizado");
                onSaved();
                setOpen(false);
              } catch {
                toast.error("Erro ao atualizar PIX");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewReimbursementDialog({
  championships,
  onCreated,
}: {
  championships: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [championship_id, setChampionshipId] = useState("");
  const [category, setCategory] = useState<string>("alimentacao");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expense_date, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const callUpload = useServerFn(createReceiptUploadUrl);
  const callCreate = useServerFn(createReimbursement);

  const reset = () => {
    setChampionshipId("");
    setCategory("alimentacao");
    setDescription("");
    setAmount("");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setFile(null);
  };

  const submit = async () => {
    if (!championship_id) { toast.error("Selecione o campeonato"); return; }
    const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!cents || cents <= 0) { toast.error("Valor inválido"); return; }
    setSaving(true);
    try {
      let receipt_path: string | null = null;
      if (file) {
        const up = await callUpload({ data: { filename: file.name } });
        const putRes = await fetch(up.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!putRes.ok) throw new Error("Falha no upload do comprovante");
        receipt_path = up.path;
      }
      await callCreate({
        data: {
          championship_id,
          category: category as any,
          description,
          amount_cents: cents,
          expense_date,
          receipt_path,
        },
      });
      toast.success("Reembolso lançado");
      reset();
      setOpen(false);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message?.includes("CHAMPIONSHIP_NOT_ALLOWED") ? "Campeonato inválido" : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero" size="sm"><Plus className="size-4" /> Novo reembolso</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo reembolso</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Campeonato</Label>
            <Select value={championship_id} onValueChange={setChampionshipId}>
              <SelectTrigger><SelectValue placeholder="Selecione o campeonato" /></SelectTrigger>
              <SelectContent>
                {championships.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Data da despesa</Label>
            <Input type="date" value={expense_date} onChange={(e) => setExpenseDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o gasto" />
          </div>
          <div className="space-y-1.5">
            <Label>Comprovante (opcional)</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button variant="hero" className="w-full" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Wallet className="size-4 mr-2" />}
            Lançar reembolso
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
