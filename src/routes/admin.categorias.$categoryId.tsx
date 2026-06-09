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
import { useServerFn } from "@tanstack/react-start";
import { refundRegistration } from "@/lib/payments.functions";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle, Users, Pencil, UserPlus, Loader2, RotateCcw, CreditCard, QrCode } from "lucide-react";
import { AdminPinDialog } from "@/components/AdminPinDialog";

const PAYMENT_METHOD_LABEL: Record<string, { label: string; icon: React.ReactNode }> = {
  pix:         { label: "PIX",      icon: <QrCode className="size-3" /> },
  credit_card: { label: "Cartão",   icon: <CreditCard className="size-3" /> },
  cash:        { label: "Dinheiro", icon: null },
};
function brl(cents: number) { return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`; }

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
  const [manualOpen, setManualOpen] = useState(false);
  const [pinDialog, setPinDialog] = useState<{ title: string; description: string; action: () => Promise<void> } | null>(null);
  const callRefund = useServerFn(refundRegistration);

  const handleRefund = (id: string, voucher: string, amountCents: number) => {
    setPinDialog({
      title: "Confirmar estorno",
      description: `Estornar inscrição ${voucher} (${brl(amountCents)})? O valor será devolvido ao pagador e a inscrição cancelada.`,
      action: async () => {
        await callRefund({ data: { registration_id: id } });
        toast.success(`Estorno realizado — ${brl(amountCents)} devolvidos`);
        qc.invalidateQueries({ queryKey: ["adm-cat-regs", categoryId] });
      },
    });
  };

  const { data: cat } = useQuery({
    queryKey: ["adm-cat", categoryId],
    queryFn: async () => (await supabase.from("categories").select("*, championship:championships(*)").eq("id", categoryId).maybeSingle()).data,
  });

  const { data: regs } = useQuery({
    queryKey: ["adm-cat-regs", categoryId],
    queryFn: async () => (await supabase.from("registrations").select("*, category:categories(price_cents)").eq("category_id", categoryId).order("created_at", { ascending: false })).data ?? [],
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
        <Button variant="hero" onClick={() => setManualOpen(true)}>
          <UserPlus className="size-4" /> Inscrever dupla
        </Button>
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
              <TableHead>Pagamento</TableHead>
              <TableHead>Confirmado em</TableHead>
              <TableHead>Data inscrição</TableHead>
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
                <TableCell className="text-xs whitespace-nowrap">
                  {r.amount_cents > 0 && (
                    <span className="font-semibold">{brl(r.amount_cents)}{r.installments > 1 ? ` (${r.installments}x)` : ""}</span>
                  )}
                  {r.payment_method && (() => {
                    const pm = PAYMENT_METHOD_LABEL[r.payment_method];
                    return pm ? <span className="flex items-center gap-1 mt-0.5 text-muted-foreground">{pm.icon}{pm.label}</span> : null;
                  })()}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                  {r.confirmed_at ? new Date(r.confirmed_at).toLocaleString("pt-BR") : "—"}
                </TableCell>
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
                    {r.status === "confirmed" && r.asaas_payment_id && (
                      <Button
                        size="sm" variant="outline"
                        className="text-destructive border-destructive/40 hover:bg-destructive/10"
                        title="Estornar pagamento"
                        onClick={() => handleRefund(r.id, r.voucher_code, r.amount_cents)}
                      >
                        <RotateCcw className="size-4" />
                      </Button>
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
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhuma inscrição.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <EditRegistrationDialog
        key={editing?.id ?? "none"}
        registration={editing}
        ageRuleMode={cat?.age_rule_mode ?? "none"}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["adm-cat-regs", categoryId] }); }}
      />

      <ManualRegistrationDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        categoryId={categoryId}
        ageRuleMode={cat?.age_rule_mode ?? "none"}
        onSaved={() => {
          setManualOpen(false);
          qc.invalidateQueries({ queryKey: ["adm-cat-regs", categoryId] });
        }}
      />

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

function ManualRegistrationDialog({
  open, onClose, categoryId, ageRuleMode, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  ageRuleMode: string;
  onSaved: () => void;
}) {
  const showAge = ageRuleMode && ageRuleMode !== "none";
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contact_email: "",
    contact_phone: "",
    team_name: "",
    athlete1_name: "",
    athlete1_shirt_size: "M",
    athlete1_shorts_size: "M",
    athlete1_birthdate: "",
    athlete2_name: "",
    athlete2_shirt_size: "M",
    athlete2_shorts_size: "M",
    athlete2_birthdate: "",
    reason: "" as "cash" | "sponsor" | "courtesy" | "other" | "",
    note: "",
  });

  const reset = () => setForm({
    contact_email: "", contact_phone: "", team_name: "",
    athlete1_name: "", athlete1_shirt_size: "M", athlete1_shorts_size: "M", athlete1_birthdate: "",
    athlete2_name: "", athlete2_shirt_size: "M", athlete2_shorts_size: "M", athlete2_birthdate: "",
    reason: "", note: "",
  });

  const save = async () => {
    if (!form.team_name.trim() || !form.athlete1_name.trim() || !form.athlete2_name.trim()) {
      toast.error("Preencha nome da dupla e dos dois atletas");
      return;
    }
    if (!form.contact_email.trim() && !form.contact_phone.trim()) {
      toast.error("Informe ao menos e-mail ou WhatsApp");
      return;
    }
    if (!form.reason) {
      toast.error("Selecione o motivo da inscrição manual");
      return;
    }
    setSaving(true);
    try {
      // 1. Criar inscrição via RPC (valida vagas com lock no banco)
      const { data, error } = await supabase.rpc("create_registration", {
        payload: {
          category_id: categoryId,
          contact_email: form.contact_email.toLowerCase().trim() || `admin+${Date.now()}@opensync.com.br`,
          contact_phone: form.contact_phone || "",
          team_name: form.team_name.trim(),
          athlete1_name: form.athlete1_name.trim(),
          athlete1_shirt_size: form.athlete1_shirt_size,
          athlete1_shorts_size: form.athlete1_shorts_size,
          athlete1_birthdate: form.athlete1_birthdate || null,
          athlete2_name: form.athlete2_name.trim(),
          athlete2_shirt_size: form.athlete2_shirt_size,
          athlete2_shorts_size: form.athlete2_shorts_size,
          athlete2_birthdate: form.athlete2_birthdate || null,
          terms_accepted: true,
        },
      });
      if (error) {
        if (error.message.includes("SLOTS_FULL")) toast.error("Categoria sem vagas disponíveis");
        else toast.error(error.message);
        return;
      }

      // 2. Confirmar automaticamente (inscrição manual não precisa de pagamento)
      const voucher = (data as any)?.voucher_code;
      if (voucher) {
        const { data: reg } = await supabase
          .from("registrations")
          .select("id")
          .eq("voucher_code", voucher)
          .maybeSingle();
        if (reg?.id) {
          await supabase.rpc("confirm_registration", {
            _id: reg.id,
            _reason: form.reason,
            _note: form.note.trim() || null,
          });
        }
      }

      toast.success(`Dupla inscrita e confirmada! Voucher: ${voucher}`);
      reset();
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao inscrever dupla");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" /> Inscrever dupla manualmente
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">A inscrição será criada e confirmada automaticamente, sem necessidade de pagamento.</p>

        <div className="space-y-4">
          {/* Justificativa */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
            <h4 className="font-semibold text-sm text-primary">Justificativa da inscrição manual</h4>
            <div className="space-y-2">
              <Label>Motivo <span className="text-destructive">*</span></Label>
              <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v as typeof form.reason })}>
                <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Pagamento em dinheiro / PIX direto</SelectItem>
                  <SelectItem value="sponsor">Patrocinador</SelectItem>
                  <SelectItem value="courtesy">Cortesia</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observação <span className="text-xs text-muted-foreground">(opcional)</span></Label>
              <Input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Ex: pagamento recebido via PIX em 31/05, comprovante arquivado"
                maxLength={500}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>E-mail de contato</Label>
              <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="dupla@email.com" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: maskPhone(e.target.value) })} placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nome da dupla</Label>
            <Input value={form.team_name} onChange={(e) => setForm({ ...form, team_name: e.target.value })} placeholder="Ex: Os Invencíveis" />
          </div>

          {[1, 2].map((n) => {
            const nameKey = `athlete${n}_name` as keyof typeof form;
            const shirtKey = `athlete${n}_shirt_size` as keyof typeof form;
            const shortsKey = `athlete${n}_shorts_size` as keyof typeof form;
            const birthKey = `athlete${n}_birthdate` as keyof typeof form;
            return (
              <div key={n} className="rounded-lg border border-border/50 p-3 space-y-3">
                <h4 className="font-semibold text-primary">Atleta {n}</h4>
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input value={form[nameKey]} onChange={(e) => setForm({ ...form, [nameKey]: e.target.value })} />
                </div>
                {showAge && (
                  <div className="space-y-2">
                    <Label>Data de nascimento</Label>
                    <Input type="date" value={form[birthKey]} onChange={(e) => setForm({ ...form, [birthKey]: e.target.value })} />
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Camiseta</Label>
                    <Select value={form[shirtKey]} onValueChange={(v) => setForm({ ...form, [shirtKey]: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SHIRT_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Shorts</Label>
                    <Select value={form[shortsKey]} onValueChange={(v) => setForm({ ...form, [shortsKey]: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SHIRT_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { onClose(); reset(); }}>Cancelar</Button>
          <Button variant="hero" onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="size-4 animate-spin mr-2" />Inscrevendo…</> : <><UserPlus className="size-4 mr-2" />Inscrever e confirmar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRegistrationDialog({ registration, ageRuleMode, onClose, onSaved }: { registration: any | null; ageRuleMode: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(() => registration ? {
    contact_email: registration.contact_email ?? "",
    contact_phone: registration.contact_phone ?? "",
    team_name: registration.team_name ?? "",
    athlete1_name: registration.athlete1_name ?? "",
    athlete1_shirt_size: registration.athlete1_shirt_size ?? "M",
    athlete1_shorts_size: registration.athlete1_shorts_size ?? "M",
    athlete1_birthdate: registration.athlete1_birthdate ?? "",
    athlete2_name: registration.athlete2_name ?? "",
    athlete2_shirt_size: registration.athlete2_shirt_size ?? "M",
    athlete2_shorts_size: registration.athlete2_shorts_size ?? "M",
    athlete2_birthdate: registration.athlete2_birthdate ?? "",
  } : null);
  const [saving, setSaving] = useState(false);
  const showAge = ageRuleMode && ageRuleMode !== "none";

  if (!registration || !form) return null;

  const save = async () => {
    setSaving(true);
    const payload: any = { ...form };
    payload.contact_email = payload.contact_email.toLowerCase().trim();
    payload.athlete1_birthdate = payload.athlete1_birthdate || null;
    payload.athlete2_birthdate = payload.athlete2_birthdate || null;
    const { error } = await supabase.from("registrations").update(payload).eq("id", registration.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Inscrição atualizada"); onSaved(); }
  };

  return (
    <Dialog open={!!registration} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar inscrição — {registration.voucher_code}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div className="space-y-2"><Label>WhatsApp</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: maskPhone(e.target.value) })} /></div>
          </div>
          <div className="space-y-2"><Label>Nome da dupla</Label><Input value={form.team_name} onChange={(e) => setForm({ ...form, team_name: e.target.value })} /></div>

          {[1, 2].map((n) => {
            const nameKey = `athlete${n}_name`;
            const shirtKey = `athlete${n}_shirt_size`;
            const shortsKey = `athlete${n}_shorts_size`;
            const birthKey = `athlete${n}_birthdate`;
            return (
              <div key={n} className="rounded-lg border border-border/50 p-3 space-y-3">
                <h4 className="font-semibold text-primary">Atleta {n}</h4>
                <div className="space-y-2"><Label>Nome completo</Label><Input value={(form as any)[nameKey]} onChange={(e) => setForm({ ...form, [nameKey]: e.target.value })} /></div>
                {showAge && (
                  <div className="space-y-2"><Label>Data de nascimento</Label><Input type="date" value={(form as any)[birthKey]} onChange={(e) => setForm({ ...form, [birthKey]: e.target.value })} /></div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Camiseta</Label>
                    <Select value={(form as any)[shirtKey]} onValueChange={(v) => setForm({ ...form, [shirtKey]: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SHIRT_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Shorts</Label>
                    <Select value={(form as any)[shortsKey]} onValueChange={(v) => setForm({ ...form, [shortsKey]: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SHIRT_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="hero" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
