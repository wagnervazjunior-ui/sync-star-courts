import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { verifyAdminPin } from "@/lib/admin-pin.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onConfirmed: () => void | Promise<void>;
}

export function AdminPinDialog({ open, onOpenChange, title, description, onConfirmed }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const callVerify = useServerFn(verifyAdminPin);

  const handleOpenChange = (next: boolean) => {
    if (!next) { setPin(""); setError(""); }
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (pin.length < 4) { setError("Digite o PIN completo"); return; }
    setLoading(true);
    setError("");
    try {
      await callVerify({ data: { pin } });
      handleOpenChange(false);
      await onConfirmed();
    } catch (e: any) {
      setError(e?.message ?? "PIN incorreto");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <p className="text-sm text-muted-foreground">Digite o PIN de segurança para confirmar</p>
          <InputOTP
            maxLength={4}
            value={pin}
            onChange={(v) => { setPin(v); setError(""); }}
            pattern={REGEXP_ONLY_DIGITS}
            onComplete={handleConfirm}
            autoFocus
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
            </InputOTPGroup>
          </InputOTP>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading || pin.length < 4}>
            {loading ? "Verificando…" : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
