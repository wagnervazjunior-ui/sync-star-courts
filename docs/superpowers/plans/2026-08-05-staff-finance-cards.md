# Cards de cachê/reembolso por staff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir as tabelas planas de cachê/reembolso (uma linha por lançamento) por um card por staff (cachê pendente + reembolso por categoria + total a pagar + botão de pagar), usando o MESMO componente em `admin.staffs.index.tsx` (lista geral) e em `StaffTab` dentro de `admin.campeonatos.$id.tsx` (aba do campeonato) — acabando com a duplicação entre as duas telas.

**Architecture:** Um componente novo `StaffFinanceCards` (recebe listas já filtradas de reembolsos/cachês, agrupa por staff no cliente com `useMemo`, renderiza um card por staff) mais um hook novo `usePixConfirmation` (extrai o par de diálogos "confirmar favorecido + PIN" que hoje só existe dentro de `StaffFinanceCards`). Os dois arquivos de página são então editados: removem as tabelas antigas (e todo o código que só servia a elas) e passam a renderizar `<StaffFinanceCards />`.

**Tech Stack:** React 19, TanStack Router/Query/Start, mesmo padrão já usado no redesenho anterior (`payStaffBalanceViaAsaas`, `AdminPinDialog`).

## Global Constraints

- Sem framework de testes automatizado no projeto. A verificação de cada task é: `npx tsc --noEmit` sem erros novos (ignorar os erros pré-existentes não relacionados, já documentados em tasks anteriores) + passo manual descrito na task.
- Nenhuma server function nova é criada neste plano — só reorganização de frontend em cima de `payStaffBalanceViaAsaas`, `adminListReimbursements` e `adminListFees`, que já existem.
- Categorias de reembolso continuam as 6 fixas: `alimentacao, transporte, passagem, gasolina, hospedagem, outro`.
- O botão de pagar (`payStaffBalanceViaAsaas`) só pode aparecer quando há um `championship_id` específico em contexto (nunca em "todos os campeonatos") — mesma regra já usada no painel "Fechar conta".

---

### Task 1: Hook compartilhado de confirmação PIX (favorecido + PIN)

**Files:**
- Create: `src/hooks/usePixConfirmation.tsx`

**Interfaces:**
- Produces: `usePixConfirmation()` → `{ openPixConfirmation(staffName, pixKey, pixType, pinTitle, pinDescription, action), dialogs: JSX.Element }`. `dialogs` deve ser renderizado uma vez no componente que usa o hook.
- Consumes: `AdminPinDialog` (`@/components/AdminPinDialog`, já existe), `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` (`@/components/ui/dialog`), `Button` (`@/components/ui/button`), `toast` (`sonner`).

Este código é uma extração literal do padrão já usado (e já testado em produção) em `src/routes/admin.staffs.$staffId.tsx` — mesmo texto, mesmo comportamento, só movido pra um hook reutilizável.

- [ ] **Step 1: Criar o hook**

Crie `src/hooks/usePixConfirmation.tsx`:

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminPinDialog } from "@/components/AdminPinDialog";

type PinDialogState = { title: string; description: string; action: () => Promise<void> } | null;
type BeneficiaryDialogState = {
  title: string;
  description: string;
  staffName: string;
  pixKey: string;
  pixType: string;
  action: () => void;
} | null;

export function usePixConfirmation() {
  const [pinDialog, setPinDialog] = useState<PinDialogState>(null);
  const [beneficiaryDialog, setBeneficiaryDialog] = useState<BeneficiaryDialogState>(null);

  const openPixConfirmation = (
    staffName: string,
    pixKey: string,
    pixType: string,
    pinTitle: string,
    pinDescription: string,
    action: () => Promise<void>,
  ) => {
    setBeneficiaryDialog({
      title: pinTitle,
      description: pinDescription,
      staffName,
      pixKey,
      pixType,
      action: () => setPinDialog({ title: pinTitle, description: pinDescription, action }),
    });
  };

  const dialogs = (
    <>
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
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">
                  Chave PIX ({beneficiaryDialog?.pixType?.toUpperCase()})
                </p>
                <p className="font-mono text-sm break-all">{beneficiaryDialog?.pixKey}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              O staff declarou que esses dados estão corretos no momento do cadastro. Esta operação não pode ser desfeita.
            </p>
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
    </>
  );

  return { openPixConfirmation, dialogs };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep usePixConfirmation`
Expected: nenhuma linha de erro.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePixConfirmation.tsx
git commit -m "$(cat <<'EOF'
Extrair hook usePixConfirmation (diálogo de favorecido + PIN)

Mesmo padrão já usado em admin.staffs.$staffId.tsx, movido pra um hook
reutilizável — vai ser consumido pelo componente StaffFinanceCards
(próxima task) sem duplicar o par de diálogos uma terceira vez.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Componente `StaffFinanceCards`

**Files:**
- Create: `src/components/StaffFinanceCards.tsx`

**Interfaces:**
- Consumes: `usePixConfirmation` (Task 1), `payStaffBalanceViaAsaas` (`@/lib/staff.functions`, já existe — assinatura `{ staff_id, championship_id } → { ok, transfer_id, total_cents, count }`).
- Produces: `<StaffFinanceCards reimbursements={...} fees={...} championshipId={...} isMaster={...} onPaid={...} />`, usado nas Tasks 3 e 4.

Formato dos itens de `reimbursements`/`fees` (retorno de `adminListReimbursements`/`adminListFees`, já usado hoje nas tabelas que serão removidas): cada item tem `.staff.{id, name, pix_key, pix_key_type}`, `.amount_cents: number`, `.status: "pending" | "paid"`; reembolsos também têm `.category: string`.

- [ ] **Step 1: Criar o componente**

Crie `src/components/StaffFinanceCards.tsx`:

```tsx
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { payStaffBalanceViaAsaas } from "@/lib/staff.functions";
import { usePixConfirmation } from "@/hooks/usePixConfirmation";

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

type StaffGroup = {
  staffId: string;
  name: string;
  pixKey: string;
  pixType: string;
  feePendingTotal: number;
  reimbPendingTotal: number;
  reimbByCategory: Array<{ category: string; total: number; paid: number }>;
  totalToPay: number;
};

type StaffFinanceCardsProps = {
  reimbursements: any[];
  fees: any[];
  /** id do campeonato em contexto; null = tela geral sem campeonato específico selecionado (some o botão de pagar) */
  championshipId: string | null;
  isMaster: boolean;
  /** chamado depois de um pagamento bem-sucedido, pro chamador invalidar suas queries */
  onPaid: () => void;
};

export function StaffFinanceCards({ reimbursements, fees, championshipId, isMaster, onPaid }: StaffFinanceCardsProps) {
  const callPayBalance = useServerFn(payStaffBalanceViaAsaas);
  const { openPixConfirmation, dialogs } = usePixConfirmation();

  const groups = useMemo<StaffGroup[]>(() => {
    type Acc = {
      name: string;
      pixKey: string;
      pixType: string;
      feePendingTotal: number;
      reimbPendingTotal: number;
      reimbCategoryMap: Map<string, { total: number; paid: number }>;
    };
    const map = new Map<string, Acc>();

    const ensure = (s: any): Acc | null => {
      if (!s?.id) return null;
      let g = map.get(s.id);
      if (!g) {
        g = {
          name: s.name,
          pixKey: s.pix_key,
          pixType: s.pix_key_type,
          feePendingTotal: 0,
          reimbPendingTotal: 0,
          reimbCategoryMap: new Map(),
        };
        map.set(s.id, g);
      }
      return g;
    };

    for (const f of fees as any[]) {
      const g = ensure(f.staff);
      if (!g) continue;
      if (f.status === "pending") g.feePendingTotal += f.amount_cents;
    }

    for (const r of reimbursements as any[]) {
      const g = ensure(r.staff);
      if (!g) continue;
      const cur = g.reimbCategoryMap.get(r.category) ?? { total: 0, paid: 0 };
      cur.total += r.amount_cents;
      if (r.status === "paid") cur.paid += r.amount_cents;
      g.reimbCategoryMap.set(r.category, cur);
      if (r.status === "pending") g.reimbPendingTotal += r.amount_cents;
    }

    return Array.from(map.entries())
      .map(([staffId, g]) => ({
        staffId,
        name: g.name,
        pixKey: g.pixKey,
        pixType: g.pixType,
        feePendingTotal: g.feePendingTotal,
        reimbPendingTotal: g.reimbPendingTotal,
        reimbByCategory: Array.from(g.reimbCategoryMap.entries())
          .map(([category, v]) => ({ category, ...v }))
          .filter((c) => c.total > 0)
          .sort((a, b) => b.total - a.total),
        totalToPay: g.feePendingTotal + g.reimbPendingTotal,
      }))
      .sort((a, b) => b.totalToPay - a.totalToPay || a.name.localeCompare(b.name));
  }, [reimbursements, fees]);

  const payStaffBalance = (staffId: string, name: string, pixKey: string, pixType: string, totalCents: number) => {
    if (!championshipId) return;
    openPixConfirmation(
      name,
      pixKey,
      pixType,
      "Pagar tudo via PIX",
      `Pagar ${brl(totalCents)} via PIX para ${name}`,
      async () => {
        const res = await callPayBalance({ data: { staff_id: staffId, championship_id: championshipId } });
        toast.success(`PIX enviado! ${res.count} lançamento${res.count === 1 ? "" : "s"} pago${res.count === 1 ? "" : "s"}.`);
        onPaid();
      },
    );
  };

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum cachê ou reembolso lançado neste filtro.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((g) => (
          <Card key={g.staffId} className="p-4 bg-gradient-card border-border/50 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to="/admin/staffs/$staffId"
                  params={{ staffId: g.staffId }}
                  className="font-semibold hover:text-primary hover:underline"
                >
                  {g.name}
                </Link>
                {g.pixKey && (
                  <button
                    className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground hover:text-primary"
                    onClick={() => { navigator.clipboard.writeText(g.pixKey); toast.success("PIX copiado"); }}
                  >
                    <Copy className="size-3" /> {g.pixKey}
                  </button>
                )}
              </div>
              <Link
                to="/admin/staffs/$staffId"
                params={{ staffId: g.staffId }}
                className="text-xs text-muted-foreground hover:text-primary shrink-0"
              >
                Ver detalhes
              </Link>
            </div>

            <div className="space-y-1.5 text-sm">
              {g.feePendingTotal > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cachê pendente</span>
                  <span className="font-medium">{brl(g.feePendingTotal)}</span>
                </div>
              )}
              {g.reimbByCategory.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Reembolso por categoria</p>
                  <div className="space-y-1">
                    {g.reimbByCategory.map((c) => (
                      <div key={c.category} className="flex items-center justify-between text-xs">
                        <span>{CATEGORY_LABEL[c.category] ?? c.category}</span>
                        <span>
                          {brl(c.total)}
                          {c.paid > 0 && <span className="text-muted-foreground"> (pago {brl(c.paid)})</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {g.feePendingTotal === 0 && g.reimbByCategory.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem lançamentos neste filtro.</p>
              )}
            </div>

            {g.totalToPay > 0 && (
              <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Total a pagar</p>
                  <p className="font-bold">{brl(g.totalToPay)}</p>
                </div>
                {isMaster && championshipId && (
                  <Button
                    size="sm"
                    variant="hero"
                    onClick={() => payStaffBalance(g.staffId, g.name, g.pixKey, g.pixType, g.totalToPay)}
                  >
                    💸 Pagar tudo via PIX
                  </Button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
      {dialogs}
    </>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep StaffFinanceCards`
Expected: nenhuma linha de erro.

- [ ] **Step 3: Commit**

```bash
git add src/components/StaffFinanceCards.tsx
git commit -m "$(cat <<'EOF'
Adicionar componente StaffFinanceCards (card por staff)

Agrupa reembolsos+cachês por staff no cliente e mostra cachê pendente,
reembolso por categoria e total a pagar num card, com botão de pagar
tudo via PIX (payStaffBalanceViaAsaas) quando há um campeonato
específico em contexto. Ainda não é usado em nenhuma tela (próximas
duas tasks substituem as tabelas antigas por ele).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Integrar em `admin.staffs.index.tsx` (lista geral)

**Files:**
- Modify: `src/routes/admin.staffs.index.tsx`

**Interfaces:**
- Consumes: `StaffFinanceCards` (Task 2).

Esta task remove a tabela plana de "Cachês combinados" e de "Reembolsos" (e todo código que só servia a elas: PIX real por item, exclusão por item, "marcar pago" por item, comprovante por item, diálogo de confirmação PIX antigo), mantendo os cards de resumo (Total/Pago/Pendente) e o bloco "Reembolsos por categoria (todos os staffs)" que já existem. A seção "Staffs cadastrados" (nome/área/CPF/contato/PIX) e o botão "Baixar Excel" **não são tocados**.

- [ ] **Step 1: Adicionar o import do componente novo**

No topo de `src/routes/admin.staffs.index.tsx`, logo após o import de `AdminPinDialog` (linha 57), adicione:

```tsx
import { StaffFinanceCards } from "@/components/StaffFinanceCards";
```

- [ ] **Step 2: Remover os imports que só serviam ao código removido**

No bloco de import de `@/lib/staff.functions` (linhas 5-33), remova estas linhas (mantendo as outras):

```
  payFeeViaAsaas,
  payReimbursementViaAsaas,
  getAsaasTransferReceipt,
  getFeeReceiptSignedUrl,
  getReceiptSignedUrl,
  setFeeStatus,
  setReimbursementStatus,
```

Mantenha `adminDeleteFee` e `adminDeleteReimbursement` só se ainda forem usados em outro lugar do arquivo — confirme com `grep -n "adminDeleteFee\|adminDeleteReimbursement" src/routes/admin.staffs.index.tsx` antes de remover; se o único uso restante for a declaração do próprio `useServerFn` (que você vai remover no Step 3), remova as duas linhas também.

Remova também a linha do import de `AdminPinDialog` (linha 57, `import { AdminPinDialog } from "@/components/AdminPinDialog";`) — não é mais usado neste arquivo depois do Step 4.

- [ ] **Step 3: Remover os hooks de server function que só serviam ao código removido**

Dentro de `function AdminStaffs()`, remova estas linhas (mantendo as outras declarações de `callX`):

```tsx
  const callStatus = useServerFn(setReimbursementStatus);
  const callReceipt = useServerFn(getReceiptSignedUrl);
  const callFeeStatus = useServerFn(setFeeStatus);
  const callFeeReceipt = useServerFn(getFeeReceiptSignedUrl);
```

e também:

```tsx
  const callPayFee = useServerFn(payFeeViaAsaas);
  const callPayReimb = useServerFn(payReimbursementViaAsaas);
```

e também (a declaração de `callDeleteReimb`/`callDeleteFee` só se você confirmou no Step 2 que não são mais usados em outro lugar):

```tsx
  const callDeleteReimb = useServerFn(adminDeleteReimbursement);
  const callDeleteFee = useServerFn(adminDeleteFee);
```

e também:

```tsx
  const callGetTransferReceipt = useServerFn(getAsaasTransferReceipt);
```

- [ ] **Step 4: Remover o estado e as funções que só serviam ao código removido**

Remova o bloco de estado dos diálogos de PIX (logo depois de `const [newReimbOpen, setNewReimbOpen] = useState(false);`):

```tsx
  const [pinDialog, setPinDialog] = useState<{ title: string; description: string; action: () => Promise<void> } | null>(null);
```

e:

```tsx
  const [beneficiaryDialog, setBeneficiaryDialog] = useState<{
    title: string; description: string;
    staffName: string; pixKey: string; pixType: string;
    action: () => void;
  } | null>(null);
```

Remova a função inteira `downloadTransferReceipt`:

```tsx
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

Remova as funções `toggleReimb`, `toggleFee`, `openReceipt`, `openFeeReceipt`, `deleteReimb`, `deleteFee`, `openPixConfirmation`, `payFeeAsaas`, `payReimbAsaas` (cada uma é um bloco `const nome = ... => { ... };` — remova os 9 blocos inteiros). Confirme antes com `grep -n "toggleReimb\|toggleFee\|openReceipt\|openFeeReceipt\|deleteReimb\|deleteFee\|openPixConfirmation\|payFeeAsaas\|payReimbAsaas" src/routes/admin.staffs.index.tsx` que a única ocorrência restante de cada nome (depois do Step 5) é zero.

**Não remova** `deleteStaff`, `handleRoleChange`, `linkStaff`, `unlinkStaff`, `rotate`, `handleCreateCategory`, `handleDeleteCategory`, `handleExport` — continuam em uso.

- [ ] **Step 5: Substituir as duas tabelas pelo componente novo**

Encontre o bloco que começa em `{/* Fees */}` e vai até o fechamento do `<Card>` de "Reembolsos" (a tabela de reembolsos, não o bloco "Reembolsos por categoria" que fica no meio e **não muda**). Dentro do `<Card>` de "Cachês combinados", troque o conteúdo:

De:
```tsx
        {fees.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (fees.data?.fees ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cachê lançado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
```
(...toda a tabela de cachês, até o fechamento correspondente)...
```tsx
            </table>
          </div>
        )}
      </Card>
```

Para:
```tsx
      </Card>
```

(ou seja: o `<Card>` de "Cachês combinados" passa a conter só o `<h2>` e o grid de `Stat` — remova inteiramente o `{fees.isLoading ? ... : ...}` ternário e a tabela).

Da mesma forma, dentro do `<Card>` de "Reembolsos" (depois do bloco "Reembolsos por categoria", que não muda), troque:

De:
```tsx
        {reimbs.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (reimbs.data?.reimbursements ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum reembolso encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
```
(...toda a tabela de reembolsos, até o fechamento correspondente)...
```tsx
            </table>
          </div>
        )}
      </Card>
```

Para:
```tsx
      </Card>
```

Logo depois do `</Card>` de "Reembolsos" (e antes de `<AdminNewReimbDialog`), adicione a nova seção:

```tsx
      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="size-5 text-primary" /> Staff — cachês e reembolsos
        </h2>
        <StaffFinanceCards
          reimbursements={(reimbs.data?.reimbursements ?? []) as any[]}
          fees={(fees.data?.fees ?? []) as any[]}
          championshipId={championship_id === "all" ? null : championship_id}
          isMaster={isMaster}
          onPaid={() => {
            qc.invalidateQueries({ queryKey: ["admin-reimbursements"] });
            qc.invalidateQueries({ queryKey: ["admin-fees"] });
          }}
        />
      </Card>
```

- [ ] **Step 6: Remover o diálogo de confirmação PIX antigo**

Remova o bloco inteiro (comentário `{/* Dialog: confirmar favorecido PIX */}`, o `<Dialog>` de favorecido, e o `<AdminPinDialog>` logo depois), que fica perto do fim do JSX, antes do `</div>` final do componente. É o mesmo texto que virou o hook na Task 1 — depois de removido, a última coisa antes do `</div>\n  );\n}` final deve voltar a ser o `<AdminNewReimbDialog ... />` do Step 5.

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep "admin.staffs.index"`
Expected: sem erros novos (nenhuma referência a nome removido tipo `toggleFee`, `payFeeAsaas`, etc. — se aparecer erro de "cannot find name", significa que sobrou um uso não removido; volte ao Step 4/5 e remova).

- [ ] **Step 8: Testar manualmente**

Em `/admin/staffs`: confirme que aparece um card por staff (com cachê pendente, reembolso por categoria e total a pagar), que "Ver detalhes" abre a tela do staff, que com um campeonato específico selecionado no filtro aparece "💸 Pagar tudo via PIX" (só pra admin master) e que pagar funciona (mesmo fluxo de favorecido+PIN de antes). Com "Todos os campeonatos" selecionado, confirme que o botão de pagar não aparece. Confirme que "Staffs cadastrados" e "Baixar Excel" continuam funcionando iguais.

- [ ] **Step 9: Commit**

```bash
git add src/routes/admin.staffs.index.tsx
git commit -m "$(cat <<'EOF'
Trocar tabelas de cachê/reembolso por cards por staff em /admin/staffs

Remove as tabelas planas (uma linha por lançamento) e todo o código que
só existia pra elas (PIX/exclusão/comprovante por item, diálogo de
confirmação antigo), substituindo por StaffFinanceCards — um card por
staff com total a pagar e pagamento unificado ali mesmo. Os cards de
resumo geral (totais e por categoria), "Staffs cadastrados" e "Baixar
Excel" continuam iguais.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Integrar em `StaffTab` (aba do campeonato)

**Files:**
- Modify: `src/routes/admin.campeonatos.$id.tsx`

**Interfaces:**
- Consumes: `StaffFinanceCards` (Task 2), `useAuth` (`@/hooks/useAuth`, já importado no topo do arquivo, mas `StaffTab` ainda não chama).

Esta task resolve a duplicação do outro lado: `StaffTab` ganha exatamente as mesmas ações que a lista geral (PIX real, exclusão, comprovante — hoje ela não tinha nenhuma dessas, só "Marcar pago" sem PIX de verdade). Como `StaffTab` já está sempre dentro de um campeonato específico (prop `id`), o botão de pagar fica sempre disponível (quando há pendência), sem precisar de filtro extra.

- [ ] **Step 1: Adicionar o import do componente novo**

No topo de `src/routes/admin.campeonatos.$id.tsx`, logo após o import de `SimulateBracketDialog` (linha 48), adicione:

```tsx
import { StaffFinanceCards } from "@/components/StaffFinanceCards";
```

- [ ] **Step 2: Remover os imports/hooks que só serviam à tabela removida**

`StaffTab` usa `setReimbursementStatus`, `getReceiptSignedUrl`, `setFeeStatus`, `getFeeReceiptSignedUrl` só pra `toggleReimb`/`openReceipt`/`toggleFee`/`openFeeReceipt`, que serão removidos no Step 4. Confirme com `grep -n "setReimbursementStatus\|getReceiptSignedUrl\|setFeeStatus\|getFeeReceiptSignedUrl" src/routes/admin.campeonatos.$id.tsx` se esses nomes são usados em outra função do arquivo (é um arquivo grande, com várias tabs) — **só remova do import geral do arquivo se não sobrar nenhum outro uso**. Se sobrar uso em outra tab, não remova o import, só remova as declarações locais de `callStatus`/`callReceipt`/`callFeeStatus`/`callFeeReceipt` dentro de `StaffTab` (Step 3).

- [ ] **Step 3: Adicionar `useAuth` dentro de `StaffTab` e remover hooks não usados**

No início de `function StaffTab({ id }: { id: string }) {`, logo depois de `const qc = useQueryClient();`, adicione:

```tsx
  const { isMaster } = useAuth();
```

Remova estas quatro linhas de dentro de `StaffTab` (não usadas depois do Step 4):

```tsx
  const callStatus = useServerFn(setReimbursementStatus);
  const callReceipt = useServerFn(getReceiptSignedUrl);
  const callFeeStatus = useServerFn(setFeeStatus);
  const callFeeReceipt = useServerFn(getFeeReceiptSignedUrl);
```

- [ ] **Step 4: Remover as funções que só serviam à tabela removida**

Dentro de `StaffTab`, remova os 4 blocos: `toggleReimb`, `toggleFee`, `openReceipt`, `openFeeReceipt`:

```tsx
  const toggleReimb = async (rid: string, current: "pending" | "paid") => {
    await callStatus({ data: { id: rid, status: current === "paid" ? "pending" : "paid" } });
    qc.invalidateQueries({ queryKey: ["champ-staff-reimbs", id] });
    toast.success(current === "paid" ? "Marcado como pendente" : "Marcado como pago");
  };
  const toggleFee = async (fid: string, current: "pending" | "paid") => {
    await callFeeStatus({ data: { id: fid, status: current === "paid" ? "pending" : "paid" } });
    qc.invalidateQueries({ queryKey: ["champ-staff-fees", id] });
    toast.success(current === "paid" ? "Marcado como pendente" : "Marcado como pago");
  };
  const openReceipt = async (rid: string) => {
    const { url } = await callReceipt({ data: { reimbursement_id: rid } });
    if (url) window.open(url, "_blank"); else toast.error("Comprovante indisponível");
  };
  const openFeeReceipt = async (fid: string) => {
    const { url } = await callFeeReceipt({ data: { fee_id: fid } });
    if (url) window.open(url, "_blank"); else toast.error("Comprovante indisponível");
  };
```

**Não remova** `handleExport` nem o componente local `StatBox` — continuam em uso pela Card de filtros/export e pelos totais que ficam.

- [ ] **Step 5: Substituir as duas tabelas pelo componente novo**

No `<Card>` de "Cachês combinados" dentro de `StaffTab`, troque:

De:
```tsx
        {fees.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
          : (fees.data?.fees ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum cachê lançado.</p>
          : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
```
(...toda a tabela de cachês, até o fechamento correspondente)...
```tsx
            </table>
          </div>
        )}
      </Card>
```

Para:
```tsx
      </Card>
```

No `<Card>` de "Reembolsos" dentro de `StaffTab`, troque:

De:
```tsx
        {reimbs.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
          : (reimbs.data?.reimbursements ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum reembolso encontrado.</p>
          : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
```
(...toda a tabela de reembolsos, até o fechamento correspondente)...
```tsx
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
```

Para:
```tsx
      </Card>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Wallet className="size-5 text-primary" /> Staff — cachês e reembolsos
        </h2>
        <StaffFinanceCards
          reimbursements={(reimbs.data?.reimbursements ?? []) as any[]}
          fees={(fees.data?.fees ?? []) as any[]}
          championshipId={id}
          isMaster={isMaster}
          onPaid={() => {
            qc.invalidateQueries({ queryKey: ["champ-staff-reimbs", id] });
            qc.invalidateQueries({ queryKey: ["champ-staff-fees", id] });
          }}
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep "admin.campeonatos"`
Expected: sem erros novos relacionados a `StaffTab` (o arquivo tem outras tabs; confirme que qualquer erro pré-existente listado não é sobre `toggleReimb`/`toggleFee`/`openReceipt`/`openFeeReceipt`/nomes removidos).

- [ ] **Step 7: Testar manualmente**

Abra um campeonato → aba "Staff". Confirme que aparece um card por staff (mesmo visual da lista geral), que "💸 Pagar tudo via PIX" aparece direto (sem precisar escolher campeonato, já que está implícito) quando há pendência e o usuário é master, que pagar funciona, e que "Ver detalhes" leva pro mesmo staff na tela de detalhe. Confirme que "Baixar Excel" desta aba continua funcionando.

- [ ] **Step 8: Commit**

```bash
git add src/routes/admin.campeonatos.\$id.tsx
git commit -m "$(cat <<'EOF'
Trazer StaffFinanceCards pra aba Staff dentro do campeonato

A aba era uma versão mais simples e antiga da mesma tela (sem PIX real,
sem exclusão, sem comprovante Asaas). Agora usa o mesmo componente da
lista geral, com championshipId sempre fixo no campeonato da página —
acaba a duplicação entre as duas telas.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Depois de todas as tasks

Revisão final de branch (`superpowers:requesting-code-review`, modelo mais capaz disponível), depois:

```bash
npm run build
./node_modules/.bin/wrangler deploy
git push origin main
```

Confirmar visualmente em produção:
1. `/admin/staffs`: cards aparecem, pagamento unificado funciona com campeonato específico selecionado, some sem filtro.
2. Aba "Staff" dentro de um campeonato: mesmo visual, botão de pagar sempre disponível.
3. "Ver detalhes" em qualquer card leva pra tela de detalhe do staff, que continua com a tabela linha-a-linha, exclusão por item e comprovante por item.
