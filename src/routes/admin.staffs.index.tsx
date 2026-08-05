import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminCreateReimbursement,
  adminDeleteFee,
  adminDeleteReimbursement,
  adminDeleteStaff,
  adminListFees,
  adminListReimbursements,
  adminUpsertFee,
  createAdminReceiptUploadUrl,
  createOrRotateStaffInviteForChampionship,
  createStaffCategory,
  deleteStaffCategory,
  exportStaffFinanceXlsx,
  updateStaffRole,
  payFeeViaAsaas,
  payReimbursementViaAsaas,
  getAsaasTransferReceipt,
  STAFF_ROLES,
  getFeeReceiptSignedUrl,
  getReceiptSignedUrl,
  linkStaffToChampionship,
  listManageableChampionships,
  listMyStaffs,
  listStaffCategories,
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
import { Copy, Download, FileText, Link as LinkIcon, Link2, Loader2, Plus, RefreshCw, Tag, Trash2, Trophy, Users, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AdminPinDialog } from "@/components/AdminPinDialog";

export const Route = createFileRoute("/admin/staffs/")({
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
  const { isMaster } = useAuth();
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
  const callDeleteStaff = useServerFn(adminDeleteStaff);
  const callPayFee = useServerFn(payFeeViaAsaas);
  const callPayReimb = useServerFn(payReimbursementViaAsaas);
  const callDeleteReimb = useServerFn(adminDeleteReimbursement);
  const callDeleteFee = useServerFn(adminDeleteFee);
  const callListCategories = useServerFn(listStaffCategories);
  const callCreateCategory = useServerFn(createStaffCategory);
  const callDeleteCategory = useServerFn(deleteStaffCategory);
  const [exporting, setExporting] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [pinDialog, setPinDialog] = useState<{ title: string; description: string; action: () => Promise<void> } | null>(null);
  const [newReimbOpen, setNewReimbOpen] = useState(false);
  const callAdminCreateReimb = useServerFn(adminCreateReimbursement);
  const callAdminUpload = useServerFn(createAdminReceiptUploadUrl);
  const callGetTransferReceipt = useServerFn(getAsaasTransferReceipt);
  const [beneficiaryDialog, setBeneficiaryDialog] = useState<{
    title: string; description: string;
    staffName: string; pixKey: string; pixType: string;
    action: () => void;
  } | null>(null);

  const downloadTransferReceipt = async (transferId: string, label: string) => {
    try {
      const res = await callGetTransferReceipt({ data: { transfer_id: transferId } });
      if (res.type === "url" && res.value) {
        window.open(res.value, "_blank");
      } else if (res.type === "pdf" && res.value) {
        const bytes = Uint8Array.from(atob(res.value), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/pdf" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `comprovante-${label}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        toast.error("Comprovante não disponível no Asaas");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao buscar comprovante");
    }
  };

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
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const callUpdateRole = useServerFn(updateStaffRole);

  const champs = useQuery({ queryKey: ["admin-manageable-champs"], queryFn: () => callChamps() });
  const invites = useQuery({ queryKey: ["admin-staff-invites"], queryFn: () => callInvites() });
  const categories = useQuery({ queryKey: ["admin-staff-categories"], queryFn: () => callListCategories() });
  const callLink = useServerFn(linkStaffToChampionship);
  const callUnlink = useServerFn(unlinkStaffFromChampionship);
  const staffs = useQuery({
    queryKey: ["admin-staffs", championship_id],
    queryFn: () =>
      callStaffs({
        data: { championship_id: championship_id === "all" ? null : championship_id },
      }),
  });
  const availableStaffs = useQuery({
    queryKey: ["admin-staffs-available", championship_id],
    enabled: championship_id !== "all",
    queryFn: () =>
      callStaffs({
        data: { not_in_championship_id: championship_id },
      }),
  });
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

  const totalsByCategory = useMemo(() => {
    const rs = reimbs.data?.reimbursements ?? [];
    const map = new Map<string, { total: number; paid: number }>();
    for (const r of rs as any[]) {
      const cur = map.get(r.category) ?? { total: 0, paid: 0 };
      cur.total += r.amount_cents;
      if (r.status === "paid") cur.paid += r.amount_cents;
      map.set(r.category, cur);
    }
    return Array.from(map.entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.total - a.total);
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

  const linkStaff = async (staffId: string, champId: string) => {
    try {
      await callLink({ data: { staff_id: staffId, championship_id: champId } });
      qc.invalidateQueries({ queryKey: ["admin-staffs"] });
      qc.invalidateQueries({ queryKey: ["admin-staffs-available"] });
      toast.success("Staff vinculado ao torneio");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao vincular");
    }
  };

  const unlinkStaff = async (staffId: string, champId: string) => {
    if (!confirm("Desvincular este staff do torneio?")) return;
    try {
      await callUnlink({ data: { staff_id: staffId, championship_id: champId } });
      qc.invalidateQueries({ queryKey: ["admin-staffs"] });
      qc.invalidateQueries({ queryKey: ["admin-staffs-available"] });
      toast.success("Staff desvinculado");
    } catch (e: any) {
      if (e?.message === "HAS_FINANCIAL_RECORDS") {
        toast.error("Não é possível desvincular: há cachês ou reembolsos vinculados.");
      } else {
        toast.error(e?.message || "Falha ao desvincular");
      }
    }
  };

  const openFeeReceipt = async (id: string) => {
    const { url } = await callFeeReceipt({ data: { fee_id: id } });
    if (url) window.open(url, "_blank");
    else toast.error("Comprovante indisponível");
  };

  const deleteStaff = async (id: string, name: string) => {
    if (!confirm(`Excluir o staff "${name}"? Todos os dados dele (sessões, reembolsos, cachês, vínculos) serão removidos.`)) return;
    try {
      await callDeleteStaff({ data: { staff_id: id } });
      qc.invalidateQueries({ queryKey: ["admin-staffs"] });
      qc.invalidateQueries({ queryKey: ["admin-reimbursements"] });
      qc.invalidateQueries({ queryKey: ["admin-fees"] });
      toast.success("Staff excluído");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao excluir staff");
    }
  };

  const deleteReimb = async (id: string) => {
    if (!confirm("Excluir este reembolso?")) return;
    try {
      await callDeleteReimb({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin-reimbursements"] });
      toast.success("Reembolso excluído");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao excluir reembolso");
    }
  };

  const handleRoleChange = async (staffId: string, role: string) => {
    try {
      await callUpdateRole({ data: { staff_id: staffId, staff_role: role === "none" ? null : role } });
      qc.invalidateQueries({ queryKey: ["admin-staffs"] });
      toast.success("Área atualizada");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao atualizar área");
    }
  };

  const deleteFee = async (id: string) => {
    if (!confirm("Excluir este cachê?")) return;
    try {
      await callDeleteFee({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin-fees"] });
      toast.success("Cachê excluído");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao excluir cachê");
    }
  };

  const openPixConfirmation = (
    staffName: string, pixKey: string, pixType: string,
    pinTitle: string, pinDescription: string,
    action: () => Promise<void>,
  ) => {
    setBeneficiaryDialog({
      title: pinTitle, description: pinDescription,
      staffName, pixKey, pixType,
      action: () => setPinDialog({ title: pinTitle, description: pinDescription, action }),
    });
  };

  const payFeeAsaas = (id: string, staffName: string, amountCents: number, pixKey: string, pixType: string) => {
    openPixConfirmation(
      staffName, pixKey, pixType,
      "Confirmar pagamento PIX",
      `Pagar R$ ${(amountCents / 100).toFixed(2).replace(".", ",")} via PIX para ${staffName}`,
      async () => {
        const res = await callPayFee({ data: { fee_id: id } });
        toast.success(`PIX enviado! Transfer: ${res.transfer_id}`);
        qc.invalidateQueries({ queryKey: ["admin-fees"] });
      },
    );
  };

  const payReimbAsaas = (id: string, staffName: string, amountCents: number, pixKey: string, pixType: string) => {
    openPixConfirmation(
      staffName, pixKey, pixType,
      "Confirmar reembolso PIX",
      `Pagar R$ ${(amountCents / 100).toFixed(2).replace(".", ",")} via PIX para ${staffName}`,
      async () => {
        const res = await callPayReimb({ data: { reimbursement_id: id } });
        toast.success(`PIX enviado! Transfer: ${res.transfer_id}`);
        qc.invalidateQueries({ queryKey: ["admin-reimbursements"] });
      },
    );
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreatingCategory(true);
    try {
      await callCreateCategory({ data: { name } });
      setNewCategoryName("");
      qc.invalidateQueries({ queryKey: ["admin-staff-categories"] });
      toast.success("Categoria criada");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao criar categoria");
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Excluir a categoria "${name}"?`)) return;
    try {
      await callDeleteCategory({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin-staff-categories"] });
      toast.success("Categoria excluída");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao excluir categoria");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="size-6 text-primary" />
        <h1 className="text-2xl font-bold">Staffs</h1>
      </div>

      {/* Categories management */}
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="size-4 text-primary" />
          <h2 className="font-semibold">Categorias de staff</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Crie categorias que os staffs irão selecionar no momento do cadastro (ex.: Árbitro, Coordenador, Voluntário).
        </p>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Nome da categoria"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); }}
            className="max-w-xs"
          />
          <Button variant="hero" size="sm" onClick={handleCreateCategory} disabled={creatingCategory || !newCategoryName.trim()}>
            {creatingCategory ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Adicionar
          </Button>
        </div>
        {categories.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (categories.data?.categories ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma categoria criada.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(categories.data!.categories as any[]).map((cat) => (
              <div key={cat.id} className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-sm">
                <Tag className="size-3 text-primary" />
                <span>{cat.name}</span>
                <button
                  className="ml-1 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  title="Excluir categoria"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

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
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <h2 className="font-semibold">
            {championship_id === "all"
              ? "Staffs cadastrados"
              : `Staffs deste torneio`}
          </h2>
          <Input
            placeholder="Buscar por nome, CPF ou e-mail"
            value={staffSearch}
            onChange={(e) => setStaffSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {championship_id === "all"
            ? "Mostrando todos os staffs que você já cadastrou. Use o filtro de campeonato abaixo para vincular/desvincular staffs a um torneio específico."
            : `Filtrando por: ${
                champs.data?.championships.find((c) => c.id === championship_id)?.name ?? "—"
              }`}
        </p>
        {staffs.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (staffs.data?.staffs ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {championship_id === "all"
              ? "Nenhum staff cadastrado."
              : "Nenhum staff vinculado a este torneio."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Área</th>
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
                    const matchSearch = !q || (
                      (s.name ?? "").toLowerCase().includes(q) ||
                      (s.cpf ?? "").toLowerCase().includes(q) ||
                      (s.contact_email ?? "").toLowerCase().includes(q)
                    );
                    const matchRole = roleFilter === "all" || s.staff_role === roleFilter;
                    return matchSearch && matchRole;
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
                    <td className="py-2 pr-3">
                      <Select
                        value={s.staff_role ?? "none"}
                        onValueChange={(v) => handleRoleChange(s.id, v)}
                      >
                        <SelectTrigger className="h-7 text-xs w-36">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {STAFF_ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <div className="flex gap-1 justify-end flex-wrap">
                        <LinkToChampionshipDialog
                          staff={s}
                          championships={(champs.data?.championships ?? []).filter(
                            (c) => !(s.championship_ids ?? []).includes(c.id),
                          )}
                          onLinked={(champId: string) => linkStaff(s.id, champId)}
                        />
                        {championship_id !== "all" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => unlinkStaff(s.id, championship_id)}
                            title="Desvincular deste torneio"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                        <AdminFeeDialog
                          staff={s}
                          championships={champs.data?.championships ?? []}
                          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-fees"] })}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteStaff(s.id, s.name)}
                          title="Excluir staff"
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

        {championship_id !== "all" && (
          <div className="mt-6 pt-6 border-t border-border/40">
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
              <Link2 className="size-4 text-primary" /> Disponíveis para vincular
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Seus staffs já cadastrados que ainda não estão neste torneio.
            </p>
            {availableStaffs.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (availableStaffs.data?.staffs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todos os seus staffs já estão neste torneio.
              </p>
            ) : (
              <div className="space-y-2">
                {(availableStaffs.data!.staffs as any[]).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/40 p-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.cpf}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="hero"
                      onClick={() => linkStaff(s.id, championship_id)}
                    >
                      <Link2 className="size-3" /> Vincular
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as áreas</SelectItem>
                {STAFF_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
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
                      <div className="flex gap-1 justify-end flex-wrap">
                        {r.receipt_path && (
                          <Button size="sm" variant="ghost" onClick={() => openFeeReceipt(r.id)} title="Ver anexo">
                            <FileText className="size-4" />
                          </Button>
                        )}
                        {r.status === "pending" && isMaster && (
                          <Button size="sm" variant="hero" onClick={() => payFeeAsaas(r.id, r.staff?.name, r.amount_cents, r.staff?.pix_key, r.staff?.pix_key_type)} title="Enviar PIX via Asaas">
                            💸 PIX
                          </Button>
                        )}
                        {r.status === "paid" && r.asaas_transfer_id && (
                          <Button size="sm" variant="ghost" onClick={() => downloadTransferReceipt(r.asaas_transfer_id, r.staff?.name ?? r.id)} title="Baixar comprovante Asaas">
                            <Download className="size-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={r.status === "paid" ? "outline" : "secondary"}
                          onClick={() => toggleFee(r.id, r.status)}
                        >
                          {r.status === "paid" ? "Desfazer" : "Marcar pago"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteFee(r.id)}
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

      {/* Reimbursements by Category */}
      {totalsByCategory.length > 0 && (
        <Card className="p-6 bg-gradient-card border-border/50">
          <h2 className="font-semibold mb-3">Reembolsos por categoria (todos os staffs)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {totalsByCategory.map(({ category, total, paid }) => (
              <div key={category} className="rounded-lg border border-border/40 p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABEL[category] ?? category}
                </p>
                <p className="text-lg font-bold mt-0.5">{brl(total)}</p>
                <p className="text-xs text-muted-foreground">Pago {brl(paid)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Reimbursements */}
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Reembolsos</h2>
          <Button variant="hero" size="sm" onClick={() => setNewReimbOpen(true)}>
            <Plus className="size-4" /> Novo reembolso
          </Button>
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
                      <div className="flex gap-1 justify-end flex-wrap">
                        {r.receipt_path && (
                          <Button size="sm" variant="ghost" onClick={() => openReceipt(r.id)} title="Ver comprovante">
                            <FileText className="size-4" />
                          </Button>
                        )}
                        {r.status === "pending" && isMaster && (
                          <Button size="sm" variant="hero" onClick={() => payReimbAsaas(r.id, r.staff?.name, r.amount_cents, r.staff?.pix_key, r.staff?.pix_key_type)} title="Enviar PIX via Asaas">
                            💸 PIX
                          </Button>
                        )}
                        {r.status === "paid" && r.asaas_transfer_id && (
                          <Button size="sm" variant="ghost" onClick={() => downloadTransferReceipt(r.asaas_transfer_id, r.staff?.name ?? r.id)} title="Baixar comprovante Asaas">
                            <Download className="size-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={r.status === "paid" ? "outline" : "secondary"}
                          onClick={() => toggleReimb(r.id, r.status)}
                        >
                          {r.status === "paid" ? "Desfazer" : "Marcar pago"}
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

      <AdminNewReimbDialog
        open={newReimbOpen}
        onOpenChange={setNewReimbOpen}
        staffs={(staffs.data?.staffs ?? []) as any[]}
        championships={(champs.data?.championships ?? []) as any[]}
        onCreated={() => qc.invalidateQueries({ queryKey: ["admin-reimbursements"] })}
        callCreate={callAdminCreateReimb}
        callUpload={callAdminUpload}
      />

      {/* Dialog: confirmar favorecido PIX */}
      <Dialog open={!!beneficiaryDialog} onOpenChange={(o) => { if (!o) setBeneficiaryDialog(null); }}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{beneficiaryDialog?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">{beneficiaryDialog?.description}</p>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Favorecido</p>
                <p className="font-semibold text-base">{beneficiaryDialog?.staffName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Declarado pelo próprio staff ao cadastrar</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Chave PIX ({beneficiaryDialog?.pixType?.toUpperCase()})</p>
                <p className="font-mono text-sm break-all">{beneficiaryDialog?.pixKey}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">O staff declarou que esses dados estão corretos no momento do cadastro. Esta operação não pode ser desfeita.</p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setBeneficiaryDialog(null)}>Cancelar</Button>
            <Button variant="hero" onClick={() => { beneficiaryDialog?.action(); setBeneficiaryDialog(null); }}>
              Confirmar e pagar
            </Button>
          </div>
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

function LinkToChampionshipDialog({
  staff,
  championships,
  onLinked,
}: {
  staff: { id: string; name: string };
  championships: { id: string; name: string }[];
  onLinked: (championshipId: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");

  if (championships.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSelected(""); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" title="Vincular a outro torneio">
          <Link2 className="size-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular {staff.name} a um torneio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Torneio</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder="Selecione o torneio" /></SelectTrigger>
            <SelectContent>
              {championships.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="hero"
            className="w-full"
            disabled={!selected}
            onClick={async () => {
              await onLinked(selected);
              setSelected("");
              setOpen(false);
            }}
          >
            <Link2 className="size-4 mr-2" /> Vincular
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const CATEGORY_OPTIONS = [
  { value: "alimentacao", label: "Alimentação" },
  { value: "transporte", label: "Transporte" },
  { value: "passagem", label: "Passagem" },
  { value: "gasolina", label: "Gasolina" },
  { value: "hospedagem", label: "Hospedagem" },
  { value: "outro", label: "Outro" },
] as const;

function AdminNewReimbDialog({
  open, onOpenChange, staffs, championships, onCreated, callCreate, callUpload,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  staffs: any[];
  championships: any[];
  onCreated: () => void;
  callCreate: any;
  callUpload: any;
}) {
  const [staffId, setStaffId] = useState("");
  const [championshipId, setChampionshipId] = useState("");
  const [category, setCategory] = useState("outro");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStaffId(""); setChampionshipId(""); setCategory("outro");
    setDescription(""); setAmount(""); setFile(null);
    setExpenseDate(new Date().toISOString().slice(0, 10));
  };

  const submit = async () => {
    if (!staffId) { toast.error("Selecione o staff"); return; }
    if (!championshipId) { toast.error("Selecione o campeonato"); return; }
    const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!cents || cents <= 0) { toast.error("Valor inválido"); return; }
    setSaving(true);
    try {
      let receipt_path: string | null = null;
      if (file) {
        const up = await callUpload({ data: { filename: file.name, staff_id: staffId } });
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
          staff_id: staffId,
          championship_id: championshipId,
          category,
          description,
          amount_cents: cents,
          expense_date: expenseDate,
          receipt_path,
        },
      });
      toast.success("Reembolso lançado");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo reembolso para staff</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Staff</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger><SelectValue placeholder="Selecione o staff" /></SelectTrigger>
              <SelectContent>
                {staffs.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Campeonato</Label>
            <Select value={championshipId} onValueChange={setChampionshipId}>
              <SelectTrigger><SelectValue placeholder="Selecione o campeonato" /></SelectTrigger>
              <SelectContent>
                {championships.map((c: any) => (
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
                  {CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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
            <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
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
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Lançar reembolso
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
