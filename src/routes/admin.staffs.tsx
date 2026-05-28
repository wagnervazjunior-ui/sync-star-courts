import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminListFees,
  adminListReimbursements,
  adminUpsertFee,
  createAdminReceiptUploadUrl,
  createOrRotateStaffInviteForChampionship,
  exportStaffFinanceXlsx,
  getFeeReceiptSignedUrl,
  getReceiptSignedUrl,
  linkStaffToChampionship,
  listManageableChampionships,
  listMyStaffs,
  listStaffInvites,
  setFeeStatus,
  setReimbursementStatus,
  unlinkStaffFromChampionship,
} from "@/lib/staff.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Copy, FileText, Link as LinkIcon, Loader2, Plus, RefreshCw, Trophy, Users, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/staffs")({
  head: () => ({ meta: [{ title: "Staffs — Admin Open Sync" }] }),
  component: AdminStaffs,
});

const CATEGORY_LABEL: Record<string, string> = {
  alimentacao: "Alimentação",
  transporte: "Transporte",
  passagem: "Passagem",
  gasolina: "Gasolina",
  hospedagem: "Hospedagem",
  outro: "Outro",
};

function brl(c: number) {
  return `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
}

function buildInviteUrl(token: string) {
  const base =
    typeof window !== "undefined" ? window.location.origin : "https://www.opensync.com.br";
  return `${base}/staff/cadastro/${token}`;
}

function AdminStaffs() {
  const qc = useQueryClient();
  const callChamps = useServerFn(listManageableChampionships);
  const callInvites = useServerFn(listStaffInvites);
  const callRotate = useServerFn(createOrRotateStaffInviteForChampionship);
  const callStaffs = useServerFn(listMyStaffs);
  const callList = useServerFn(adminListReimbursements);
  const callStatus = useServerFn(setReimbursementStatus);
  const callReceipt = useServerFn(getReceiptSignedUrl);
  const callFees = useServerFn(adminListFees);
  const callFeeStatus = useServerFn(setFeeStatus);
  const callFeeReceipt = useServerFn(getFeeReceiptSignedUrl);
  const callExport = useServerFn(exportStaffFinanceXlsx);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    try {
      setExporting(true);
      const res = await callExport({
        data: { championship_id: championship_id === "all" ? null : championship_id },
      });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Planilha gerada");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar planilha");
    } finally {
      setExporting(false);
    }
  }

  const [championship_id, setChampionshipId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [staffSearch, setStaffSearch] = useState<string>("");

  const champs = useQuery({ queryKey: ["admin-manageable-champs"], queryFn: () => callChamps() });
  const invites = useQuery({ queryKey: ["admin-staff-invites"], queryFn: () => callInvites() });
  const staffs = useQuery({ queryKey: ["admin-staffs"], queryFn: () => callStaffs() });
  const reimbs = useQuery({
    queryKey: ["admin-reimbursements", championship_id, status],
    queryFn: () =>
      callList({
        data: {
          championship_id: championship_id === "all" ? null : championship_id,
          status: status === "all" ? null : (status as any),
        },
      }),
  });
  const fees = useQuery({
    queryKey: ["admin-fees", championship_id, status],
    queryFn: () =>
      callFees({
        data: {
          championship_id: championship_id === "all" ? null : championship_id,
          status: status === "all" ? null : (status as any),
        },
      }),
  });

  const inviteByChamp = useMemo(() => {
    const m = new Map<string, string>();
    (invites.data?.invites ?? []).forEach((i: any) => {
      if (i.championship_id) m.set(i.championship_id, i.token);
    });
    return m;
  }, [invites.data]);

  const totals = useMemo(() => {
    const rs = reimbs.data?.reimbursements ?? [];
    const total = rs.reduce((a, r: any) => a + r.amount_cents, 0);
    const paid = rs.filter((r: any) => r.status === "paid").reduce((a, r: any) => a + r.amount_cents, 0);
    return { total, paid, pending: total - paid };
  }, [reimbs.data]);

  const feeTotals = useMemo(() => {
    const fs = fees.data?.fees ?? [];
    const total = fs.reduce((a, r: any) => a + r.amount_cents, 0);
    const paid = fs.filter((r: any) => r.status === "paid").reduce((a, r: any) => a + r.amount_cents, 0);
    return { total, paid, pending: total - paid };
  }, [fees.data]);

  const rotate = async (champId: string) => {
    await callRotate({ data: { championship_id: champId } });
    qc.invalidateQueries({ queryKey: ["admin-staff-invites"] });
    toast.success("Link gerado");
  };

  const toggleReimb = async (id: string, current: "pending" | "paid") => {
    await callStatus({ data: { id, status: current === "paid" ? "pending" : "paid" } });
    qc.invalidateQueries({ queryKey: ["admin-reimbursements"] });
    toast.success(current === "paid" ? "Marcado como pendente" : "Marcado como pago");
  };

  const toggleFee = async (id: string, current: "pending" | "paid") => {
    await callFeeStatus({ data: { id, status: current === "paid" ? "pending" : "paid" } });
    qc.invalidateQueries({ queryKey: ["admin-fees"] });
    toast.success(current === "paid" ? "Marcado como pendente" : "Marcado como pago");
  };

  const openReceipt = async (id: string) => {
    const { url } = await callReceipt({ data: { reimbursement_id: id } });
    if (url) window.open(url, "_blank");
    else toast.error("Comprovante indisponível");
  };

  const openFeeReceipt = async (id: string) => {
    const { url } = await callFeeReceipt({ data: { fee_id: id } });
    if (url) window.open(url, "_blank");
    else toast.error("Comprovante indisponível");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="size-6 text-primary" />
        <h1 className="text-2xl font-bold">Staffs</h1>
      </div>

      {/* Invites per championship */}
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <LinkIcon className="size-4 text-primary" />
          <h2 className="font-semibold">Links de cadastro por campeonato</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Cada campeonato tem seu próprio link. Quem se cadastrar pelo link fica vinculado
          àquele campeonato e poderá lançar reembolsos e cachê para ele.
        </p>
        {champs.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando campeonatos…</p>
        ) : (champs.data?.championships ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum campeonato disponível.</p>
        ) : (
          <div className="space-y-2">
            {champs.data!.championships.map((c) => {
              const token = inviteByChamp.get(c.id);
              const url = token ? buildInviteUrl(token) : null;
              return (
                <div
                  key={c.id}
                  className="flex items-start gap-3 flex-wrap rounded-lg border border-border/40 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium flex items-center gap-2">
                      <Trophy className="size-4 text-primary" />
                      {c.name}
                    </p>
                    {url ? (
                      <code className="mt-2 block text-xs break-all rounded bg-muted/40 p-2">
                        {url}
                      </code>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">Nenhum link ativo.</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(url);
                          toast.success("Link copiado");
                        }}
                      >
                        <Copy className="size-4" /> Copiar
                      </Button>
                    )}
                    <Button variant="hero" size="sm" onClick={() => rotate(c.id)}>
                      <RefreshCw className="size-4" /> {url ? "Gerar novo" : "Gerar link"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Staffs list */}
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-semibold">Staffs cadastrados</h2>
          <Input
            placeholder="Buscar por nome, CPF ou e-mail"
            value={staffSearch}
            onChange={(e) => setStaffSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        {staffs.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (staffs.data?.staffs ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum staff cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">CPF</th>
                  <th className="py-2 pr-3">Contato</th>
                  <th className="py-2 pr-3">PIX</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {staffs.data!.staffs
                  .filter((s: any) => {
                    const q = staffSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      (s.name ?? "").toLowerCase().includes(q) ||
                      (s.cpf ?? "").toLowerCase().includes(q) ||
                      (s.contact_email ?? "").toLowerCase().includes(q)
                    );
                  })
                  .map((s: any) => (
                  <tr key={s.id} className="border-t border-border/40">
                    <td className="py-2 pr-3 font-medium">
                      <Link
                        to="/admin/staffs/$staffId"
                        params={{ staffId: s.id }}
                        className="hover:text-primary hover:underline"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{s.cpf}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {s.contact_email || s.contact_phone || "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        className="inline-flex items-center gap-1 hover:text-primary"
                        onClick={() => {
                          navigator.clipboard.writeText(s.pix_key);
                          toast.success("PIX copiado");
                        }}
                      >
                        <Copy className="size-3" />{" "}
                        <span className="text-xs uppercase">{s.pix_key_type}</span> {s.pix_key}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <AdminFeeDialog
                        staff={s}
                        championships={champs.data?.championships ?? []}
                        onSaved={() => qc.invalidateQueries({ queryKey: ["admin-fees"] })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Filters */}
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="font-semibold">Filtros</h2>
          <div className="flex gap-2">
            <Select value={championship_id} onValueChange={setChampionshipId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Campeonato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os campeonatos</SelectItem>
                {(champs.data?.championships ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleExport} disabled={exporting} variant="secondary">
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            Baixar Excel
          </Button>
        </div>
      </Card>

      {/* Fees */}
      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Wallet className="size-5 text-primary" /> Cachês combinados
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Stat label="Total" value={brl(feeTotals.total)} />
          <Stat label="Pago" value={brl(feeTotals.paid)} tone="success" />
          <Stat label="Pendente" value={brl(feeTotals.pending)} tone="warn" />
        </div>
        {fees.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (fees.data?.fees ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cachê lançado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Staff</th>
                  <th className="py-2 pr-3">Campeonato</th>
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
                    <td className="py-2 pr-3 text-muted-foreground">{r.championship?.name}</td>
                    <td className="py-2 pr-3 max-w-xs truncate" title={r.description}>
                      {r.description || "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        className="inline-flex items-center gap-1 hover:text-primary text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(r.staff?.pix_key ?? "");
                          toast.success("PIX copiado");
                        }}
                      >
                        <Copy className="size-3" /> {r.staff?.pix_key}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">{brl(r.amount_cents)}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={r.status === "paid" ? "default" : "secondary"}>
                        {r.status === "paid" ? "Pago" : "Pendente"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-1 justify-end">
                        {r.receipt_path && (
                          <Button size="sm" variant="ghost" onClick={() => openFeeReceipt(r.id)} title="Ver anexo">
                            <FileText className="size-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={r.status === "paid" ? "outline" : "hero"}
                          onClick={() => toggleFee(r.id, r.status)}
                        >
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

      {/* Reimbursements */}
      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-4">Reembolsos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Stat label="Total" value={brl(totals.total)} />
          <Stat label="Pago" value={brl(totals.paid)} tone="success" />
          <Stat label="Pendente" value={brl(totals.pending)} tone="warn" />
        </div>
        {reimbs.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (reimbs.data?.reimbursements ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum reembolso encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Staff</th>
                  <th className="py-2 pr-3">Campeonato</th>
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
                    <td className="py-2 pr-3 text-muted-foreground">{r.championship?.name}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline">{CATEGORY_LABEL[r.category] ?? r.category}</Badge>
                    </td>
                    <td className="py-2 pr-3 max-w-xs truncate" title={r.description}>{r.description}</td>
                    <td className="py-2 pr-3">{new Date(r.expense_date).toLocaleDateString("pt-BR")}</td>
                    <td className="py-2 pr-3">
                      <button
                        className="inline-flex items-center gap-1 hover:text-primary text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(r.staff?.pix_key ?? "");
                          toast.success("PIX copiado");
                        }}
                      >
                        <Copy className="size-3" /> {r.staff?.pix_key}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">{brl(r.amount_cents)}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={r.status === "paid" ? "default" : "secondary"}>
                        {r.status === "paid" ? "Pago" : "Pendente"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-1 justify-end">
                        {r.receipt_path && (
                          <Button size="sm" variant="ghost" onClick={() => openReceipt(r.id)} title="Ver comprovante">
                            <FileText className="size-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={r.status === "paid" ? "outline" : "hero"}
                          onClick={() => toggleReimb(r.id, r.status)}
                        >
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warn" }) {
  return (
    <Card className="p-3 bg-card/60">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-xl font-bold ${
          tone === "success" ? "text-success" : tone === "warn" ? "text-primary" : ""
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

function AdminFeeDialog({
  staff,
  championships,
  onSaved,
}: {
  staff: { id: string; name: string };
  championships: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [championship_id, setChampionshipId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const callUpload = useServerFn(createAdminReceiptUploadUrl);
  const callUpsert = useServerFn(adminUpsertFee);

  const reset = () => {
    setChampionshipId("");
    setAmount("");
    setDescription("");
    setFile(null);
  };

  const submit = async () => {
    if (!championship_id) {
      toast.error("Selecione o campeonato");
      return;
    }
    const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!cents || cents <= 0) {
      toast.error("Valor inválido");
      return;
    }
    setSaving(true);
    try {
      let receipt_path: string | null = null;
      if (file) {
        const up = await callUpload({ data: { filename: file.name, staff_id: staff.id } });
        const putRes = await fetch(up.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!putRes.ok) throw new Error("Falha no upload");
        receipt_path = up.path;
      }
      await callUpsert({
        data: {
          staff_id: staff.id,
          championship_id,
          amount_cents: cents,
          description,
          receipt_path,
        },
      });
      toast.success("Cachê salvo");
      reset();
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-3" /> Cachê
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cachê — {staff.name}</DialogTitle>
        </DialogHeader>
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
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: cachê combinado para arbitragem"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Anexo (opcional)</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button variant="hero" className="w-full" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Wallet className="size-4 mr-2" />}
            Salvar cachê
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
