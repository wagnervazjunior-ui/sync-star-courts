import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminListReimbursements,
  createOrRotateStaffInvite,
  getReceiptSignedUrl,
  getStaffInvite,
  listMyStaffs,
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
import { Copy, FileText, Link as LinkIcon, RefreshCw, Users } from "lucide-react";
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

function AdminStaffs() {
  const qc = useQueryClient();
  const callInvite = useServerFn(getStaffInvite);
  const callRotate = useServerFn(createOrRotateStaffInvite);
  const callStaffs = useServerFn(listMyStaffs);
  const callList = useServerFn(adminListReimbursements);
  const callStatus = useServerFn(setReimbursementStatus);
  const callReceipt = useServerFn(getReceiptSignedUrl);

  const [championship_id, setChampionshipId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const invite = useQuery({ queryKey: ["admin-staff-invite"], queryFn: () => callInvite() });
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

  const championshipsOptions = useMemo(() => {
    const map = new Map<string, string>();
    (reimbs.data?.reimbursements ?? []).forEach((r: any) => {
      if (r.championship) map.set(r.championship.id, r.championship.name);
    });
    return Array.from(map.entries());
  }, [reimbs.data]);

  const totals = useMemo(() => {
    const rs = reimbs.data?.reimbursements ?? [];
    const total = rs.reduce((a, r: any) => a + r.amount_cents, 0);
    const paid = rs.filter((r: any) => r.status === "paid").reduce((a, r: any) => a + r.amount_cents, 0);
    return { total, paid, pending: total - paid };
  }, [reimbs.data]);

  const inviteUrl = invite.data?.invite?.token
    ? `${typeof window !== "undefined" ? window.location.origin : "https://www.opensync.com.br"}/staff/cadastro/${invite.data.invite.token}`
    : null;

  const rotate = async () => {
    await callRotate();
    qc.invalidateQueries({ queryKey: ["admin-staff-invite"] });
    toast.success("Novo link gerado");
  };

  const toggle = async (id: string, current: "pending" | "paid") => {
    await callStatus({ data: { id, status: current === "paid" ? "pending" : "paid" } });
    qc.invalidateQueries({ queryKey: ["admin-reimbursements"] });
    toast.success(current === "paid" ? "Marcado como pendente" : "Marcado como pago");
  };

  const openReceipt = async (id: string) => {
    const { url } = await callReceipt({ data: { reimbursement_id: id } });
    if (url) window.open(url, "_blank");
    else toast.error("Comprovante indisponível");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="size-6 text-primary" />
        <h1 className="text-2xl font-bold">Staffs</h1>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold flex items-center gap-2"><LinkIcon className="size-4" /> Link de cadastro</p>
            <p className="mt-1 text-xs text-muted-foreground">Envie este link para que os staffs façam o cadastro.</p>
            {inviteUrl ? (
              <code className="mt-2 block text-xs break-all rounded bg-muted/40 p-2">{inviteUrl}</code>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Nenhum link ativo. Gere um abaixo.</p>
            )}
          </div>
          <div className="flex gap-2">
            {inviteUrl && (
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success("Link copiado"); }}>
                <Copy className="size-4" /> Copiar
              </Button>
            )}
            <Button variant="hero" size="sm" onClick={rotate}>
              <RefreshCw className="size-4" /> {inviteUrl ? "Gerar novo" : "Gerar link"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-3">Staffs cadastrados</h2>
        {staffs.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (staffs.data?.staffs ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum staff cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="py-2 pr-3">Nome</th><th className="py-2 pr-3">CPF</th><th className="py-2 pr-3">Contato</th><th className="py-2 pr-3">PIX</th></tr>
              </thead>
              <tbody>
                {staffs.data!.staffs.map((s: any) => (
                  <tr key={s.id} className="border-t border-border/40">
                    <td className="py-2 pr-3 font-medium">{s.name}</td>
                    <td className="py-2 pr-3">{s.cpf}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{s.contact_email || s.contact_phone || "—"}</td>
                    <td className="py-2 pr-3">
                      <button
                        className="inline-flex items-center gap-1 hover:text-primary"
                        onClick={() => { navigator.clipboard.writeText(s.pix_key); toast.success("PIX copiado"); }}
                      >
                        <Copy className="size-3" /> <span className="text-xs uppercase">{s.pix_key_type}</span> {s.pix_key}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="font-semibold">Reembolsos</h2>
          <div className="flex gap-2">
            <Select value={championship_id} onValueChange={setChampionshipId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Campeonato" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os campeonatos</SelectItem>
                {championshipsOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
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
                    <td className="py-2 pr-3"><Badge variant="outline">{CATEGORY_LABEL[r.category] ?? r.category}</Badge></td>
                    <td className="py-2 pr-3 max-w-xs truncate" title={r.description}>{r.description}</td>
                    <td className="py-2 pr-3">{new Date(r.expense_date).toLocaleDateString("pt-BR")}</td>
                    <td className="py-2 pr-3">
                      <button
                        className="inline-flex items-center gap-1 hover:text-primary text-xs"
                        onClick={() => { navigator.clipboard.writeText(r.staff?.pix_key ?? ""); toast.success("PIX copiado"); }}
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
                        <Button size="sm" variant={r.status === "paid" ? "outline" : "hero"} onClick={() => toggle(r.id, r.status)}>
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
      <p className={`mt-1 text-xl font-bold ${tone === "success" ? "text-success" : tone === "warn" ? "text-primary" : ""}`}>{value}</p>
    </Card>
  );
}
