# Redesenho da área de Staff — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff consegue editar/excluir os próprios reembolsos pendentes; admin vê gasto por categoria de reembolso (por staff e geral); admin paga cachê + reembolso pendentes de um staff, no mesmo campeonato, numa única transferência PIX; a tela de detalhe do staff fica com as mesmas ações de pagamento da lista geral.

**Architecture:** TanStack Start server functions (`createServerFn`) em `src/lib/staff.functions.ts`, chamadas via `useServerFn` nas rotas React (`src/routes/staff.painel.tsx`, `src/routes/admin.staffs.$staffId.tsx`, `src/routes/admin.staffs.tsx`). Sem migração de banco — todas as colunas usadas (`status`, `asaas_transfer_id`, `paid_at`, `paid_by`) já existem em `staff_fees` e `staff_reimbursements`.

**Tech Stack:** TanStack Start, React 19, TanStack Query, Zod, Supabase (Postgres), Tailwind, shadcn/ui.

## Global Constraints

- **Sem framework de testes automatizados no projeto** (confirmado: sem `vitest`/`jest`, sem script `test` no `package.json`). A verificação de cada task é: `npx tsc --noEmit` sem erros novos + passo manual descrito na task, testado na aplicação rodando (`npm run dev` ou no ambiente já implantado). Não crie arquivos `*.test.ts` — não há runner para executá-los.
- Pagamento real via PIX (Asaas) só pode ser executado por admin master — sempre chame `assertMaster(context.userId)` nas novas server functions de pagamento.
- Toda mutação de reembolso/cachê deve validar posse (`staff_id` bate com quem está pedindo) antes de alterar — siga o padrão já usado em `adminDeleteReimbursement`/`adminDeleteFee` (`src/lib/staff.functions.ts:1218-1248`).
- Categorias de reembolso são fixas: `alimentacao`, `transporte`, `passagem`, `gasolina`, `hospedagem`, `outro` (`CATEGORY_LABEL` já definido em cada arquivo de rota — não criar uma nova fonte de verdade).
- Commits pequenos e frequentes, um por task, seguindo o padrão de mensagens já usado no repo (título curto em português, corpo explicando o "porquê", rodapé `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`).

---

### Task 1: Backend — staff editar/excluir o próprio reembolso

**Files:**
- Modify: `src/lib/staff.functions.ts` (adicionar após `createReimbursement`, que termina na linha 329)

**Interfaces:**
- Produces: `updateMyReimbursement({ id, category, description, amount_cents, expense_date, receipt_path })` → `{ ok: true }`. Lança `REIMBURSEMENT_NOT_FOUND`, `FORBIDDEN` (não é dono) ou `REIMBURSEMENT_LOCKED_PAID` (já pago).
- Produces: `deleteMyReimbursement({ id })` → `{ ok: true }`. Mesmos erros possíveis.
- Consumes: `requireStaffAuth` (middleware já existente, injeta `context.staff.id`), `CreateReimbSchema` (linha 109-116, reaproveitar o enum de categorias).

- [ ] **Step 1: Adicionar os schemas e as duas server functions**

Em `src/lib/staff.functions.ts`, logo depois do fechamento de `createReimbursement` (linha 329, `});`), adicione:

```ts
const UpdateReimbSchema = z.object({
  id: z.string().uuid(),
  category: z.enum(["alimentacao", "transporte", "passagem", "gasolina", "hospedagem", "outro"]),
  description: z.string().trim().max(500).optional().nullable(),
  amount_cents: z.number().int().positive().max(100_000_000),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receipt_path: z.string().max(500).optional().nullable(),
});

export const updateMyReimbursement = createServerFn({ method: "POST" })
  .middleware([requireStaffAuth])
  .inputValidator((input: unknown) => UpdateReimbSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await supabaseAdmin
      .from("staff_reimbursements")
      .select("id, staff_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("REIMBURSEMENT_NOT_FOUND");
    if (existing.staff_id !== context.staff.id) throw new Error("FORBIDDEN");
    if (existing.status === "paid") throw new Error("REIMBURSEMENT_LOCKED_PAID");

    const { error } = await supabaseAdmin
      .from("staff_reimbursements")
      .update({
        category: data.category,
        description: data.description?.trim() ?? "",
        amount_cents: data.amount_cents,
        expense_date: data.expense_date,
        receipt_path: data.receipt_path ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteMyReimbursement = createServerFn({ method: "POST" })
  .middleware([requireStaffAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await supabaseAdmin
      .from("staff_reimbursements")
      .select("id, staff_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("REIMBURSEMENT_NOT_FOUND");
    if (existing.staff_id !== context.staff.id) throw new Error("FORBIDDEN");
    if (existing.status === "paid") throw new Error("REIMBURSEMENT_LOCKED_PAID");

    const { error } = await supabaseAdmin.from("staff_reimbursements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep staff.functions`
Expected: nenhuma linha nova de erro relacionada a `updateMyReimbursement`/`deleteMyReimbursement` (o projeto já tem 2 erros pré-existentes não relacionados — não se preocupe com eles).

- [ ] **Step 3: Commit**

```bash
git add src/lib/staff.functions.ts
git commit -m "$(cat <<'EOF'
Permitir staff editar e excluir o próprio reembolso pendente

Duas novas server functions (updateMyReimbursement, deleteMyReimbursement)
seguindo o mesmo padrão de posse já usado em adminDeleteReimbursement:
confirma que o reembolso é do staff logado e que ainda está pendente
antes de alterar. Depois de pago, fica travado (REIMBURSEMENT_LOCKED_PAID).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Frontend — editar/excluir reembolso no painel do staff

**Files:**
- Modify: `src/routes/staff.painel.tsx`

**Interfaces:**
- Consumes: `updateMyReimbursement`, `deleteMyReimbursement` (Task 1).
- Produces: nada consumido por outras tasks (é a ponta final desta funcionalidade).

- [ ] **Step 1: Importar as novas server functions**

Em `src/routes/staff.painel.tsx`, no bloco de import de `@/lib/staff.functions` (linhas 5-17), adicione `updateMyReimbursement` e `deleteMyReimbursement`:

```ts
import {
  createReceiptUploadUrl,
  createReimbursement,
  updateMyReimbursement,
  deleteMyReimbursement,
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
```

Adicione também `Trash2` ao import de ícones (linha 39, hoje `import { Loader2, LogOut, Plus, Receipt, Wallet, Pencil, FileText, User } from "lucide-react";`):

```ts
import { Loader2, LogOut, Plus, Receipt, Wallet, Pencil, FileText, User, Trash2 } from "lucide-react";
```

- [ ] **Step 2: Atualizar `ReimbursementRow` para aceitar edição/exclusão**

Substitua a função `ReimbursementRow` inteira (linhas 231-263) por:

```tsx
function ReimbursementRow({ r, onEdit, onDeleted }: { r: any; onEdit: (r: any) => void; onDeleted: () => void }) {
  const callReceipt = useServerFn(getMyReceiptSignedUrl);
  const callDelete = useServerFn(deleteMyReimbursement);
  const [deleting, setDeleting] = useState(false);

  const openReceipt = async () => {
    const { url } = await callReceipt({ data: { reimbursement_id: r.id } });
    if (url) window.open(url, "_blank");
    else toast.error("Comprovante indisponível");
  };

  const handleDelete = async () => {
    if (!confirm("Excluir este reembolso?")) return;
    setDeleting(true);
    try {
      await callDelete({ data: { id: r.id } });
      toast.success("Reembolso excluído");
      onDeleted();
    } catch (e: any) {
      toast.error(
        e?.message === "REIMBURSEMENT_LOCKED_PAID"
          ? "Este reembolso já foi pago e não pode ser excluído"
          : "Erro ao excluir reembolso",
      );
    } finally {
      setDeleting(false);
    }
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
        {r.status === "pending" && (
          <>
            <Button size="sm" variant="ghost" onClick={() => onEdit(r)} title="Editar reembolso">
              <Pencil className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
              title="Excluir reembolso"
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `EditReimbursementDialog`**

Logo depois do fechamento de `NewReimbursementDialog` (linha 464, `}`), antes de `function FeeRow` (linha 466), adicione:

```tsx
function EditReimbursementDialog({
  open,
  onClose,
  reimbursement,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  reimbursement: {
    id: string;
    category: string;
    description: string;
    amount_cents: number;
    expense_date: string;
    receipt_path: string | null;
  } | null;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState<string>("alimentacao");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expense_date, setExpenseDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const callUpload = useServerFn(createReceiptUploadUrl);
  const callUpdate = useServerFn(updateMyReimbursement);

  useEffect(() => {
    if (!open || !reimbursement) return;
    setCategory(reimbursement.category);
    setDescription(reimbursement.description ?? "");
    setAmount((reimbursement.amount_cents / 100).toFixed(2).replace(".", ","));
    setExpenseDate(reimbursement.expense_date);
    setFile(null);
  }, [open, reimbursement]);

  if (!reimbursement) return null;

  const submit = async () => {
    const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!cents || cents <= 0) { toast.error("Valor inválido"); return; }
    setSaving(true);
    try {
      let receipt_path = reimbursement.receipt_path;
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
      await callUpdate({
        data: {
          id: reimbursement.id,
          category: category as any,
          description,
          amount_cents: cents,
          expense_date,
          receipt_path,
        },
      });
      toast.success("Reembolso atualizado");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(
        e?.message === "REIMBURSEMENT_LOCKED_PAID"
          ? "Este reembolso já foi pago e não pode ser editado"
          : "Erro ao salvar",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar reembolso</DialogTitle></DialogHeader>
        <div className="space-y-3">
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
            <Label>Novo comprovante (opcional — deixe em branco pra manter o atual)</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button variant="hero" className="w-full" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Pencil className="size-4 mr-2" />}
            Salvar alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Ligar tudo em `StaffPanel`**

Dentro de `function StaffPanel()`, adicione o estado de edição perto dos outros hooks (logo após a linha `const qc = useQueryClient();`, por volta da linha 62):

```ts
  const [editingReimb, setEditingReimb] = useState<any | null>(null);
```

Substitua o bloco de renderização da lista de reembolsos (linhas 178-182):

```tsx
            <div className="space-y-2">
              {(reimbs.data!.reimbursements as any[]).map((r) => (
                <ReimbursementRow key={r.id} r={r} />
              ))}
            </div>
```

por:

```tsx
            <div className="space-y-2">
              {(reimbs.data!.reimbursements as any[]).map((r) => (
                <ReimbursementRow
                  key={r.id}
                  r={r}
                  onEdit={setEditingReimb}
                  onDeleted={() => qc.invalidateQueries({ queryKey: ["staff-reimbursements"] })}
                />
              ))}
            </div>
```

E logo antes do fechamento de `</main>` (linha 211, `</main>`), adicione o dialog:

```tsx
        <EditReimbursementDialog
          open={!!editingReimb}
          onClose={() => setEditingReimb(null)}
          reimbursement={editingReimb}
          onSaved={() => qc.invalidateQueries({ queryKey: ["staff-reimbursements"] })}
        />
```

(precisa ficar dentro do `<div className="min-h-screen bg-background">` que engloba tudo, mas fora do `<main>` tanto faz — coloque logo depois de `</main>` e antes do `</div>` final do componente.)

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep staff.painel`
Expected: sem erros novos.

- [ ] **Step 6: Testar manualmente**

Rode a aplicação (`npm run dev` ou acesse o ambiente já publicado), entre no painel de um staff (`/staff/login`), e confira:
- Um reembolso **pendente** mostra os ícones de lápis e lixeira; um **pago**, não.
- Clicar no lápis abre o dialog já preenchido com os dados atuais; salvar atualiza a linha.
- Clicar na lixeira pede confirmação e remove a linha da lista.

- [ ] **Step 7: Commit**

```bash
git add src/routes/staff.painel.tsx
git commit -m "$(cat <<'EOF'
Permitir staff editar e excluir reembolso pendente no próprio painel

Reembolsos pendentes ganham botões de editar (abre formulário
pré-preenchido) e excluir (com confirmação). Reembolsos já pagos não
mostram essas ações — trava replicada também no backend (Task anterior).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Backend — pagamento unificado (cachê + reembolso numa PIX só)

**Files:**
- Modify: `src/lib/staff.functions.ts` (adicionar depois de `payReimbursementViaAsaas`, que termina na linha 1319)

**Interfaces:**
- Consumes: `assertMaster` (linha 1250-1253), `createPixTransfer` (import já existente, linha 18).
- Produces: `payStaffBalanceViaAsaas({ staff_id, championship_id })` → `{ ok: true, transfer_id: string, total_cents: number, count: number }`. Lança `FORBIDDEN`, `"Staff sem chave PIX cadastrada"` ou `NOTHING_TO_PAY`.

- [ ] **Step 1: Adicionar a server function**

Em `src/lib/staff.functions.ts`, logo após o fechamento de `payReimbursementViaAsaas` (linha 1319, `});`), adicione:

```ts
// ── Fechar conta: paga cachês + reembolsos pendentes de um staff, num só campeonato, numa única transferência ──
export const payStaffBalanceViaAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ staff_id: z.string().uuid(), championship_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId);
    const { data: staff } = await supabaseAdmin
      .from("staffs")
      .select("id, name, pix_key, pix_key_type, owner_admin_id")
      .eq("id", data.staff_id)
      .maybeSingle();
    if (!staff || staff.owner_admin_id !== context.userId) throw new Error("FORBIDDEN");
    if (!staff.pix_key) throw new Error("Staff sem chave PIX cadastrada");

    const [{ data: fees }, { data: reimbs }] = await Promise.all([
      supabaseAdmin
        .from("staff_fees")
        .select("id, amount_cents")
        .eq("staff_id", data.staff_id)
        .eq("championship_id", data.championship_id)
        .eq("status", "pending"),
      supabaseAdmin
        .from("staff_reimbursements")
        .select("id, amount_cents")
        .eq("staff_id", data.staff_id)
        .eq("championship_id", data.championship_id)
        .eq("status", "pending"),
    ]);

    const feeIds = (fees ?? []).map((f: any) => f.id as string);
    const reimbIds = (reimbs ?? []).map((r: any) => r.id as string);
    const totalCents =
      (fees ?? []).reduce((s: number, f: any) => s + f.amount_cents, 0) +
      (reimbs ?? []).reduce((s: number, r: any) => s + r.amount_cents, 0);

    if (totalCents <= 0) throw new Error("NOTHING_TO_PAY");

    const { data: champ } = await supabaseAdmin
      .from("championships")
      .select("name")
      .eq("id", data.championship_id)
      .maybeSingle();

    const transfer = await createPixTransfer({
      pixKey: staff.pix_key,
      pixKeyType: staff.pix_key_type,
      valueCents: totalCents,
      description: `Fechamento staff: ${staff.name} — ${champ?.name ?? ""} (${feeIds.length} cachês, ${reimbIds.length} reembolsos)`,
    });

    const now = new Date().toISOString();
    await Promise.all([
      feeIds.length
        ? supabaseAdmin
            .from("staff_fees")
            .update({ status: "paid", paid_at: now, paid_by: context.userId, asaas_transfer_id: transfer.id } as any)
            .in("id", feeIds)
        : Promise.resolve(),
      reimbIds.length
        ? supabaseAdmin
            .from("staff_reimbursements")
            .update({ status: "paid", paid_at: now, paid_by: context.userId, asaas_transfer_id: transfer.id } as any)
            .in("id", reimbIds)
        : Promise.resolve(),
    ]);

    return {
      ok: true as const,
      transfer_id: transfer.id,
      total_cents: totalCents,
      count: feeIds.length + reimbIds.length,
    };
  });
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep staff.functions`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/lib/staff.functions.ts
git commit -m "$(cat <<'EOF'
Adicionar pagamento unificado de cachê+reembolso numa única PIX

payStaffBalanceViaAsaas soma todos os cachês e reembolsos pendentes de
um staff num campeonato específico, faz uma única transferência Asaas
pelo total, e marca todos os registros incluídos como pagos com o mesmo
asaas_transfer_id.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Frontend — paridade de ações na tela de detalhe do staff

**Files:**
- Modify: `src/routes/admin.staffs.$staffId.tsx`

**Interfaces:**
- Consumes: `payFeeViaAsaas`, `payReimbursementViaAsaas`, `getAsaasTransferReceipt` (já existem em `staff.functions.ts`, usados hoje em `admin.staffs.tsx`), `useAuth` (`@/hooks/useAuth`, expõe `isMaster`), `AdminPinDialog` (`@/components/AdminPinDialog`).

Esta task só adiciona botões que já existem em `admin.staffs.tsx` (linhas 802-811 para cachês, 905-914 para reembolsos) — mesmo comportamento, mesmo componente de PIN, replicado aqui.

- [ ] **Step 1: Atualizar imports**

No topo de `src/routes/admin.staffs.$staffId.tsx`, troque o bloco de import de `@/lib/staff.functions` (linhas 5-16) por:

```ts
import {
  adminDeleteFee,
  adminDeleteReimbursement,
  adminGetStaff,
  adminListFees,
  adminListReimbursements,
  getFeeReceiptSignedUrl,
  getReceiptSignedUrl,
  getAsaasTransferReceipt,
  listManageableChampionships,
  payFeeViaAsaas,
  payReimbursementViaAsaas,
  setFeeStatus,
  setReimbursementStatus,
} from "@/lib/staff.functions";
```

Adicione logo abaixo (depois da linha do import de `lucide-react`, hoje linha 27):

```ts
import { useAuth } from "@/hooks/useAuth";
import { AdminPinDialog } from "@/components/AdminPinDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
```

E troque o import de ícones (linha 27 original, `import { ArrowLeft, Copy, FileText, Tag, Trash2 } from "lucide-react";`) por:

```ts
import { ArrowLeft, Copy, Download, FileText, Tag, Trash2 } from "lucide-react";
```

- [ ] **Step 2: Adicionar estado e helpers de pagamento PIX**

Dentro de `function AdminStaffDetail()`, logo após a linha `const callDeleteFee = useServerFn(adminDeleteFee);` (linha 60), adicione:

```ts
  const { isMaster } = useAuth();
  const callPayFee = useServerFn(payFeeViaAsaas);
  const callPayReimb = useServerFn(payReimbursementViaAsaas);
  const callGetTransferReceipt = useServerFn(getAsaasTransferReceipt);
  const [pinDialog, setPinDialog] = useState<{ title: string; description: string; action: () => Promise<void> } | null>(null);
  const [beneficiaryDialog, setBeneficiaryDialog] = useState<{
    title: string; description: string;
    staffName: string; pixKey: string; pixType: string;
    action: () => void;
  } | null>(null);

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
        qc.invalidateQueries({ queryKey: ["admin-staff-fees", staffId] });
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
        qc.invalidateQueries({ queryKey: ["admin-staff-reimbs", staffId] });
      },
    );
  };

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
```

- [ ] **Step 3: Adicionar coluna PIX + botões nas duas tabelas, renomear "Marcar pago"**

Na tabela de **Reembolsos**, adicione uma coluna PIX. O cabeçalho hoje (linhas 296-303):

```tsx
                <tr>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Campeonato</th>
                  <th className="py-2 pr-3">Categoria</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
```

vira:

```tsx
                <tr>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Campeonato</th>
                  <th className="py-2 pr-3">Categoria</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">PIX</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
```

A linha da tabela (hoje linhas 306-339) vira (adiciona `<td>` de PIX, botão de enviar PIX, botão de comprovante, e renomeia o botão de status):

```tsx
                {reimbList.map((r: any) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="py-2 pr-3">{r.expense_date}</td>
                    <td className="py-2 pr-3">{r.championship?.name}</td>
                    <td className="py-2 pr-3">{CATEGORY_LABEL[r.category] ?? r.category}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.description}</td>
                    <td className="py-2 pr-3">
                      <button
                        className="inline-flex items-center gap-1 hover:text-primary text-xs"
                        onClick={() => { navigator.clipboard.writeText(s.pix_key); toast.success("PIX copiado"); }}
                      >
                        <Copy className="size-3" /> {s.pix_key}
                      </button>
                    </td>
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
                        {r.status === "pending" && isMaster && (
                          <Button size="sm" variant="hero" onClick={() => payReimbAsaas(r.id, s.name, r.amount_cents, s.pix_key, s.pix_key_type)} title="Enviar PIX via Asaas">
                            💸 PIX
                          </Button>
                        )}
                        {r.status === "paid" && r.asaas_transfer_id && (
                          <Button size="sm" variant="ghost" onClick={() => downloadTransferReceipt(r.asaas_transfer_id, s.name ?? r.id)} title="Baixar comprovante Asaas">
                            <Download className="size-4" />
                          </Button>
                        )}
                        <Button size="sm" onClick={() => toggleReimb(r.id, r.status)} title="Sem enviar PIX pelo sistema — use para pagamentos feitos por fora">
                          {r.status === "paid" ? "Marcar pendente manualmente" : "Marcar pago manualmente"}
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
```

Note que `s` (a variável do staff, definida na linha 181 como `const s: any = staff.data?.staff;`) já está em escopo nesse ponto do componente — reaproveite `s.pix_key`/`s.name`/`s.pix_key_type` em vez de campos que não existem em `r`.

Na tabela de **Cachês**, o cabeçalho hoje (linhas 358-364):

```tsx
                <tr>
                  <th className="py-2 pr-3">Campeonato</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
```

vira:

```tsx
                <tr>
                  <th className="py-2 pr-3">Campeonato</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">PIX</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
```

E a linha da tabela (hoje linhas 366-399) vira:

```tsx
                {feeList.map((f: any) => (
                  <tr key={f.id} className="border-t border-border/40">
                    <td className="py-2 pr-3">{f.championship?.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{f.description}</td>
                    <td className="py-2 pr-3">
                      <button
                        className="inline-flex items-center gap-1 hover:text-primary text-xs"
                        onClick={() => { navigator.clipboard.writeText(s.pix_key); toast.success("PIX copiado"); }}
                      >
                        <Copy className="size-3" /> {s.pix_key}
                      </button>
                    </td>
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
                        {f.status === "pending" && isMaster && (
                          <Button size="sm" variant="hero" onClick={() => payFeeAsaas(f.id, s.name, f.amount_cents, s.pix_key, s.pix_key_type)} title="Enviar PIX via Asaas">
                            💸 PIX
                          </Button>
                        )}
                        {f.status === "paid" && f.asaas_transfer_id && (
                          <Button size="sm" variant="ghost" onClick={() => downloadTransferReceipt(f.asaas_transfer_id, s.name ?? f.id)} title="Baixar comprovante Asaas">
                            <Download className="size-4" />
                          </Button>
                        )}
                        <Button size="sm" onClick={() => toggleFee(f.id, f.status)} title="Sem enviar PIX pelo sistema — use para pagamentos feitos por fora">
                          {f.status === "paid" ? "Marcar pendente manualmente" : "Marcar pago manualmente"}
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
```

- [ ] **Step 4: Adicionar os dois dialogs (confirmação de favorecido + PIN)**

Logo antes do fechamento do componente (linha 404, `</div>` final antes de `);` `}`), adicione:

```tsx
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
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep "admin.staffs.\$staffId"`
Expected: sem erros novos.

- [ ] **Step 6: Testar manualmente**

Como admin master, abra o detalhe de um staff com cachê ou reembolso pendente e confirme:
- Aparece o botão "💸 PIX" (só pra admin master).
- Clicar abre a confirmação de favorecido, depois o PIN; confirmando, o item vira "Pago" e some o botão de PIX, aparecendo o de baixar comprovante.
- O botão antigo agora diz "Marcar pago manualmente" e continua funcionando (sem PIX real).

- [ ] **Step 7: Commit**

```bash
git add src/routes/admin.staffs.\$staffId.tsx
git commit -m "$(cat <<'EOF'
Trazer paridade de ações de pagamento pro detalhe do staff

A tela de detalhe só tinha "marcar pago" (sem enviar PIX de verdade).
Agora tem os mesmos botões de PIX real via Asaas e download de
comprovante que já existiam na lista geral, e o botão antigo passa a se
chamar "marcar pago manualmente" pra não ser confundido com o real.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Frontend — painel "Fechar conta" (pagamento unificado)

**Files:**
- Modify: `src/routes/admin.staffs.$staffId.tsx`

**Interfaces:**
- Consumes: `payStaffBalanceViaAsaas` (Task 3), estado `championship_id`/`s` (staff) e helpers `openPixConfirmation`/`pinDialog`/`beneficiaryDialog` (Task 4) já presentes no componente.

- [ ] **Step 1: Importar a nova server function**

No import de `@/lib/staff.functions` adicionado na Task 4, inclua `payStaffBalanceViaAsaas`:

```ts
import {
  adminDeleteFee,
  adminDeleteReimbursement,
  adminGetStaff,
  adminListFees,
  adminListReimbursements,
  getFeeReceiptSignedUrl,
  getReceiptSignedUrl,
  getAsaasTransferReceipt,
  listManageableChampionships,
  payFeeViaAsaas,
  payReimbursementViaAsaas,
  payStaffBalanceViaAsaas,
  setFeeStatus,
  setReimbursementStatus,
} from "@/lib/staff.functions";
```

- [ ] **Step 2: Adicionar o handler de fechamento de conta**

Depois da função `payReimbAsaas` (adicionada na Task 4), adicione:

```ts
  const callPayBalance = useServerFn(payStaffBalanceViaAsaas);

  const closeAccount = (champId: string, champName: string, totalCents: number, count: number) => {
    if (!s) return;
    openPixConfirmation(
      s.name, s.pix_key, s.pix_key_type,
      "Fechar conta via PIX",
      `Pagar R$ ${(totalCents / 100).toFixed(2).replace(".", ",")} via PIX para ${s.name} (${count} lançamento${count === 1 ? "" : "s"} de ${champName})`,
      async () => {
        const res = await callPayBalance({ data: { staff_id: staffId, championship_id: champId } });
        toast.success(`PIX enviado! ${res.count} lançamentos pagos.`);
        qc.invalidateQueries({ queryKey: ["admin-staff-reimbs", staffId] });
        qc.invalidateQueries({ queryKey: ["admin-staff-fees", staffId] });
      },
    );
  };
```

- [ ] **Step 3: Renderizar o painel quando um campeonato específico está selecionado**

Logo depois do `Card` de "Filtros" (fecha na linha 283, `</Card>`) e antes do `Card` de "Reembolsos" (linha 285), adicione:

```tsx
      {championship_id !== "all" && isMaster && (stats.rPending + stats.fPending) > 0 && (
        <Card className="p-6 bg-gradient-card border-primary/40">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold">
                Fechar conta — {champs.data?.championships.find((c) => c.id === championship_id)?.name ?? "campeonato"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {brl(stats.rPending + stats.fPending)} pendentes ({reimbList.filter((r: any) => r.status === "pending").length} reembolso(s) + {feeList.filter((f: any) => f.status === "pending").length} cachê(s))
              </p>
            </div>
            <Button
              variant="hero"
              onClick={() =>
                closeAccount(
                  championship_id,
                  champs.data?.championships.find((c) => c.id === championship_id)?.name ?? "campeonato",
                  stats.rPending + stats.fPending,
                  reimbList.filter((r: any) => r.status === "pending").length + feeList.filter((f: any) => f.status === "pending").length,
                )
              }
            >
              💸 Pagar tudo via PIX
            </Button>
          </div>
        </Card>
      )}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep "admin.staffs.\$staffId"`
Expected: sem erros novos.

- [ ] **Step 5: Testar manualmente**

Com um staff que tem cachê **e** reembolso pendentes no mesmo campeonato: selecione esse campeonato no filtro, confirme que o painel "Fechar conta" aparece com o total certo, pague, e confirme que **ambos** os itens viram "Pago" com o mesmo comprovante Asaas. Selecione "Todos os campeonatos" e confirme que o painel some.

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin.staffs.\$staffId.tsx
git commit -m "$(cat <<'EOF'
Adicionar painel "Fechar conta" — pagamento unificado por campeonato

Quando um campeonato específico está selecionado no filtro, mostra o
total pendente (cachê + reembolso somados) daquele staff naquele
campeonato com um botão único que dispara uma única transferência PIX
via payStaffBalanceViaAsaas.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Frontend — resumo por categoria (detalhe do staff)

**Files:**
- Modify: `src/routes/admin.staffs.$staffId.tsx`

**Interfaces:**
- Consumes: `reimbList` (já calculado no componente), `CATEGORY_LABEL` (já definido no arquivo, linhas 35-42).

- [ ] **Step 1: Calcular os totais por categoria**

Depois do `useMemo` de `stats` (fecha na linha 117, `}, [reimbList, feeList]);`), adicione:

```ts
  const byCategory = useMemo(() => {
    const map = new Map<string, { total: number; paid: number }>();
    for (const r of reimbList) {
      const cur = map.get(r.category) ?? { total: 0, paid: 0 };
      cur.total += r.amount_cents;
      if (r.status === "paid") cur.paid += r.amount_cents;
      map.set(r.category, cur);
    }
    return Array.from(map.entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [reimbList]);
```

- [ ] **Step 2: Renderizar o bloco**

Logo depois do grid de 4 `Card`s de totais (fecha na linha 254, `</Card>`, dentro do `<div className="grid gap-4 md:grid-cols-4">` que termina ali), e antes do `Card` de "Filtros" (linha 256), adicione:

```tsx
      {byCategory.length > 0 && (
        <Card className="p-6 bg-gradient-card border-border/50">
          <h2 className="font-semibold mb-3">Reembolsos por categoria</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {byCategory.map(({ category, total, paid }) => (
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
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep "admin.staffs.\$staffId"`
Expected: sem erros novos.

- [ ] **Step 4: Testar manualmente**

Abra o detalhe de um staff com reembolsos em mais de uma categoria e confirme que o bloco mostra uma linha por categoria usada, com o total e o valor já pago, ordenado do maior pro menor total.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin.staffs.\$staffId.tsx
git commit -m "$(cat <<'EOF'
Mostrar reembolsos por categoria no detalhe do staff

Bloco calculado no cliente a partir da lista já carregada — sem função
nova no backend. Categorias sem lançamento não aparecem.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Frontend — resumo por categoria (visão geral)

**Files:**
- Modify: `src/routes/admin.staffs.tsx`

**Interfaces:**
- Consumes: `reimbs.data?.reimbursements` (já carregado pela query existente, linhas 194-203), `CATEGORY_LABEL` (já definido, linhas 64-71), `totals` (`useMemo` existente, linhas 223-228).

- [ ] **Step 1: Calcular os totais por categoria**

Logo depois do `useMemo` de `totals` (fecha na linha 228, `}, [reimbs.data]);`), adicione:

```ts
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
```

- [ ] **Step 2: Renderizar o bloco antes da tabela de Reembolsos**

Logo antes do `Card` de "Reembolsos" (linha 839, `<Card className="p-6 bg-gradient-card border-border/50">` seguido de `<h2 className="font-semibold">Reembolsos</h2>` na linha 841), adicione:

```tsx
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

```

(o filtro de campeonato/status já existente na tela — linhas 194-203 — se aplica automaticamente aqui também, já que `totalsByCategory` deriva de `reimbs.data`, a mesma query filtrada.)

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep "admin.staffs.tsx"`
Expected: sem erros novos.

- [ ] **Step 4: Testar manualmente**

Em `/admin/staffs`, com o filtro de campeonato em "Todos" e depois num campeonato específico, confirme que o bloco de categorias aparece e os totais mudam de acordo com o filtro (mesma lista usada pela tabela de baixo).

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin.staffs.tsx
git commit -m "$(cat <<'EOF'
Mostrar resumo de reembolsos por categoria na lista geral de staffs

Agrega todos os staffs do filtro de campeonato/status atual — mesma
fonte de dados já usada pela tabela de reembolsos, sem query nova.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Depois de todas as tasks

Depois de completar as 7 tasks (todas commitadas), rode o build completo e publique, seguindo o fluxo já usado neste projeto:

```bash
npm run build
./node_modules/.bin/wrangler deploy
```

Confirme visualmente em produção:
1. Staff edita e exclui um reembolso pendente no painel dele.
2. Admin vê o resumo por categoria (detalhe do staff e lista geral).
3. Admin fecha a conta de um staff com cachê+reembolso pendentes numa única PIX.
4. As ações de PIX/comprovante na tela de detalhe do staff funcionam igual à lista geral.
