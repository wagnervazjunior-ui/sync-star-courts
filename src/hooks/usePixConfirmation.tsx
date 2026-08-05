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
