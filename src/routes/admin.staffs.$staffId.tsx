import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminDeleteFee,
  adminDeleteReimbursement,
  adminGetStaff,
  adminListFees,
  adminListReimbursements,
  getFeeReceiptSignedUrl,
  getReceiptSignedUrl,
  listManageableChampionships,
  setFeeStatus,
  setReimbursementStatus,
} from "@/lib/staff.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Copy, FileText, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/staffs/$staffId")({
  head: () => ({ meta: [{ title: "Detalhe do staff — Admin" }] }),
  component: AdminStaffDetail,
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

function AdminStaffDetail() {
  const { staffId } = Route.useParams();
  const qc = useQueryClient();
  const callStaff = useServerFn(adminGetStaff);
  const callChamps = useServerFn(listManageableChampionships);
  const callReimbs = useServerFn(adminListReimbursements);
  const callFees = useServerFn(adminListFees);
  const callReimbStatus = useServerFn(setReimbursementStatus);
  const callFeeStatus = useServerFn(setFeeStatus);
  const callReceipt = useServerFn(getReceiptSignedUrl);
  const callFeeReceipt = useServerFn(getFeeReceiptSignedUrl);
  const callDeleteReimb = useServerFn(adminDeleteReimbursement);
  const callDeleteFee = useServerFn(adminDeleteFee);

  const [championship_id, setChampionshipId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const staff = useQuery({
    queryKey: ["admin-staff", staffId],
    queryFn: () => callStaff({ data: { staff_id: staffId } }),
  });
  const champs = useQuery({
    queryKey: ["admin-manageable-champs"],
    queryFn: () => callChamps(),
  });
  const reimbs = useQuery({
    queryKey: ["admin-staff-reimbs", staffId, championship_id, status],
    queryFn: () =>
      callReimbs({
        data: {
          staff_id: staffId,
          championship_id: championship_id === "all" ? null : championship_id,
          status: status === "all" ? null : (status as any),
        },
      }),
  });
  const fees = useQuery({
    queryKey: ["admin-staff-fees", staffId, championship_id, status],
    queryFn: () =>
      callFees({
        data: {
          staff_id: staffId,
          championship_id: championship_id === "all" ? null : championship_id,
          status: status === "all" ? null : (status as any),
        },
      }),
  });

  const reimbList = reimbs.data?.reimbursements ?? [];
  const feeList = fees.data?.fees ?? [];

  const stats = useMemo(() => {
    const rTotal = reimbList.reduce((a: number, r: any) => a + (r.amount_cents ?? 0), 0);
    const rPaid = reimbList
      .filter((r: any) => r.status === "paid")
      .reduce((a: number, r: any) => a + (r.amount_cents ?? 0), 0);
    const fTotal = feeList.reduce((a: number, f: any) => a + (f.amount_cents ?? 0), 0);
    const fPaid = feeList
      .filter((f: any) => f.status === "paid")
      .reduce((a: number, f: any) => a + (f.amount_cents ?? 0), 0);
    return {
      rTotal,
      rPaid,
      rPending: rTotal - rPaid,
      fTotal,
      fPaid,
      fPending: fTotal - fPaid,
      grand: rTotal + fTotal,
    };
  }, [reimbList, feeList]);

  async function toggleReimb(id: string, current: "pending" | "paid") {
    try {
      await callReimbStatus({ data: { id, status: current === "paid" ? "pending" : "paid" } });
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin-staff-reimbs", staffId] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao atualizar");
    }
  }

  async function toggleFee(id: string, current: "pending" | "paid") {
    try {
      await callFeeStatus({ data: { id, status: current === "paid" ? "pending" : "paid" } });
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin-staff-fees", staffId] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao atualizar");
    }
  }

  async function openReceipt(reimbId: string) {
    try {
      const { url } = await callReceipt({ data: { reimbursement_id: reimbId } });
      if (url) window.open(url, "_blank");
      else toast.message("Sem comprovante");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao abrir comprovante");
    }
  }

  async function openFeeReceipt(feeId: string) {
    try {
      const { url } = await callFeeReceipt({ data: { fee_id: feeId } });
      if (url) window.open(url, "_blank");
      else toast.message("Sem comprovante");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao abrir comprovante");
    }
  }

  async function deleteReimb(id: string) {
    if (!confirm("Excluir este reembolso?")) return;
    try {
      await callDeleteReimb({ data: { id } });
      toast.success("Reembolso excluído");
      qc.invalidateQueries({ queryKey: ["admin-staff-reimbs", staffId] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao excluir reembolso");
    }
  }

  async function deleteFee(id: string) {
    if (!confirm("Excluir este cachê?")) return;
    try {
      await callDeleteFee({ data: { id } });
      toast.success("Cachê excluído");
      qc.invalidateQueries({ queryKey: ["admin-staff-fees", staffId] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao excluir cachê");
    }
  }

  const s: any = staff.data?.staff;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          to="/admin/staffs"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Voltar para staffs
        </Link>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        {staff.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !s ? (
          <p className="text-sm text-muted-foreground">Staff não encontrado.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h1 className="text-2xl font-bold">{s.name}</h1>
              {s.category?.name && (
                <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-medium">
                  <Tag className="size-3" /> {s.category.name}
                </span>
              )}
              <p className="text-sm text-muted-foreground mt-1">CPF: {s.cpf}</p>
              <p className="text-sm text-muted-foreground">
                {s.contact_email || s.contact_phone || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Chave PIX</p>
              <button
                className="inline-flex items-center gap-2 mt-1 hover:text-primary"
                onClick={() => {
                  navigator.clipboard.writeText(s.pix_key);
                  toast.success("PIX copiado");
                }}
              >
                <Copy className="size-4" />
                <span className="text-xs uppercase">{s.pix_key_type}</span>
                <span className="font-medium">{s.pix_key}</span>
              </button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4 bg-gradient-card border-border/50">
          <p className="text-xs uppercase text-muted-foreground">Reembolsos (total)</p>
          <p className="text-xl font-bold mt-1">{brl(stats.rTotal)}</p>
          <p className="text-xs text-muted-foreground">
            Pago {brl(stats.rPaid)} · Pendente {brl(stats.rPending)}
          </p>
        </Card>
        <Card className="p-4 bg-gradient-card border-border/50">
          <p className="text-xs uppercase text-muted-foreground">Cachês (total)</p>
          <p className="text-xl font-bold mt-1">{brl(stats.fTotal)}</p>
          <p className="text-xs text-muted-foreground">
            Pago {brl(stats.fPaid)} · Pendente {brl(stats.fPending)}
          </p>
        </Card>
        <Card className="p-4 bg-gradient-card border-border/50">
          <p className="text-xs uppercase text-muted-foreground">Total geral</p>
          <p className="text-xl font-bold mt-1">{brl(stats.grand)}</p>
        </Card>
        <Card className="p-4 bg-gradient-card border-border/50">
          <p className="text-xs uppercase text-muted-foreground">A pagar</p>
          <p className="text-xl font-bold mt-1">{brl(stats.rPending + stats.fPending)}</p>
        </Card>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="font-semibold">Filtros</h2>
          <div className="flex gap-2 flex-wrap">
            <Select value={championship_id} onValueChange={setChampionshipId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Campeonato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os campeonatos</SelectItem>
                {(((champs.data as any)?.championships ?? (champs.data as any) ?? []) as any[]).map((c: any) => (
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
        </div>
      </Card>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-3">Reembolsos</h2>
        {reimbs.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : reimbList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum reembolso.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Campeonato</th>
                  <th className="py-2 pr-3">Categoria</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {reimbList.map((r: any) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="py-2 pr-3">{r.expense_date}</td>
                    <td className="py-2 pr-3">{r.championship?.name}</td>
                    <td className="py-2 pr-3">{CATEGORY_LABEL[r.category] ?? r.category}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.description}</td>
                    <td className="py-2 pr-3 font-medium">{brl(r.amount_cents)}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={r.status === "paid" ? "default" : "secondary"}>
                        {r.status === "paid" ? "Pago" : "Pendente"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <div className="inline-flex gap-1 justify-end flex-wrap">
                        {r.receipt_path && (
                          <Button size="sm" variant="outline" onClick={() => openReceipt(r.id)}>
                            <FileText className="size-3" /> Comprovante
                          </Button>
                        )}
                        <Button size="sm" onClick={() => toggleReimb(r.id, r.status)}>
                          {r.status === "paid" ? "Marcar pendente" : "Marcar pago"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteReimb(r.id)}
                          title="Excluir reembolso"
                        >
                          <Trash2 className="size-3" />
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
        <h2 className="font-semibold mb-3">Cachês</h2>
        {fees.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : feeList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cachê.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Campeonato</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {feeList.map((f: any) => (
                  <tr key={f.id} className="border-t border-border/40">
                    <td className="py-2 pr-3">{f.championship?.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{f.description}</td>
                    <td className="py-2 pr-3 font-medium">{brl(f.amount_cents)}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={f.status === "paid" ? "default" : "secondary"}>
                        {f.status === "paid" ? "Pago" : "Pendente"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <div className="inline-flex gap-1 justify-end flex-wrap">
                        {f.receipt_path && (
                          <Button size="sm" variant="outline" onClick={() => openFeeReceipt(f.id)}>
                            <FileText className="size-3" /> Comprovante
                          </Button>
                        )}
                        <Button size="sm" onClick={() => toggleFee(f.id, f.status)}>
                          {f.status === "paid" ? "Marcar pendente" : "Marcar pago"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteFee(f.id)}
                          title="Excluir cachê"
                        >
                          <Trash2 className="size-3" />
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
