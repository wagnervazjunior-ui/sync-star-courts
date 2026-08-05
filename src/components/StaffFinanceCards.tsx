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
