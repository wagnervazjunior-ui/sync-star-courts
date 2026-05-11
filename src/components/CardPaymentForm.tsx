import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { createCardCharge } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const schema = z.object({
  holderName: z.string().trim().min(3, "Nome impresso no cartão"),
  cardNumber: z.string().trim().min(13, "Número inválido").max(23),
  expiry: z.string().regex(/^\d{2}\/\d{2,4}$/, "MM/AA"),
  ccv: z.string().regex(/^\d{3,4}$/, "CCV inválido"),
  holderCpf: z.string().trim().min(11, "CPF inválido").max(14),
  holderPostalCode: z.string().trim().min(8, "CEP inválido").max(9),
  holderAddressNumber: z.string().trim().min(1, "Número do endereço"),
  installments: z.coerce.number().int().min(1).max(12),
});
type Values = z.infer<typeof schema>;

const maskCard = (v: string) =>
  v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
const maskExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 6);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
};
const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};
const maskCep = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

type Props = { voucher: string; amountCents: number; onConfirmed: () => void };
type Result = { status: "confirmed" | "processing" | "failed"; error?: string };

export function CardPaymentForm({ voucher, amountCents, onConfirmed }: Props) {
  const callCard = useServerFn(createCardCharge);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { installments: 1 } as any,
  });

  const installmentOptions = useMemo(() => {
    const max = amountCents >= 1000 ? 12 : 1;
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [amountCents]);

  const onSubmit = async (v: Values) => {
    const [mm, yyRaw] = v.expiry.split("/");
    const yy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
    setSubmitting(true);
    setResult(null);
    try {
      const res = (await callCard({
        data: {
          voucher,
          holderName: v.holderName.trim(),
          cardNumber: v.cardNumber.replace(/\s/g, ""),
          expiryMonth: mm,
          expiryYear: yy,
          ccv: v.ccv,
          holderCpf: v.holderCpf,
          holderPostalCode: v.holderPostalCode,
          holderAddressNumber: v.holderAddressNumber,
          installments: Number(v.installments),
        },
      })) as Result;
      setResult(res);
      if (res.status === "confirmed") onConfirmed();
    } catch (err: any) {
      setResult({ status: "failed", error: err?.message ?? "Erro inesperado" });
    } finally {
      setSubmitting(false);
    }
  };

  if (result?.status === "confirmed") {
    return (
      <div className="flex items-center gap-3 rounded-md border border-success/40 bg-success/10 p-4 text-success">
        <CheckCircle2 className="size-5" />
        <p className="text-sm">Pagamento aprovado! Atualizando…</p>
      </div>
    );
  }
  if (result?.status === "processing") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-md border border-primary/40 bg-primary/10 p-4">
          <Clock className="size-5 mt-0.5 text-primary" />
          <div className="text-sm">
            <p className="font-semibold">Pagamento em análise antifraude</p>
            <p className="text-muted-foreground">
              Você receberá uma confirmação por e-mail em até 1 hora. Esta tela atualiza sozinha.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {result?.status === "failed" && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4 mt-0.5" />
          <span>{result.error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label>Número do cartão</Label>
        <Input
          inputMode="numeric"
          placeholder="0000 0000 0000 0000"
          {...form.register("cardNumber")}
          onChange={(e) => form.setValue("cardNumber", maskCard(e.target.value))}
        />
        {form.formState.errors.cardNumber && (
          <p className="text-xs text-destructive">{form.formState.errors.cardNumber.message}</p>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2">
        <div className="space-y-2">
          <Label>Validade</Label>
          <Input
            placeholder="MM/AA"
            {...form.register("expiry")}
            onChange={(e) => form.setValue("expiry", maskExpiry(e.target.value))}
          />
          {form.formState.errors.expiry && (
            <p className="text-xs text-destructive">{form.formState.errors.expiry.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>CCV</Label>
          <Input inputMode="numeric" maxLength={4} {...form.register("ccv")} />
          {form.formState.errors.ccv && (
            <p className="text-xs text-destructive">{form.formState.errors.ccv.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Nome impresso no cartão</Label>
        <Input {...form.register("holderName")} />
        {form.formState.errors.holderName && (
          <p className="text-xs text-destructive">{form.formState.errors.holderName.message}</p>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2">
        <div className="space-y-2">
          <Label>CPF do titular</Label>
          <Input
            inputMode="numeric"
            placeholder="000.000.000-00"
            {...form.register("holderCpf")}
            onChange={(e) => form.setValue("holderCpf", maskCpf(e.target.value))}
          />
          {form.formState.errors.holderCpf && (
            <p className="text-xs text-destructive">{form.formState.errors.holderCpf.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>CEP</Label>
          <Input
            inputMode="numeric"
            placeholder="00000-000"
            {...form.register("holderPostalCode")}
            onChange={(e) => form.setValue("holderPostalCode", maskCep(e.target.value))}
          />
          {form.formState.errors.holderPostalCode && (
            <p className="text-xs text-destructive">{form.formState.errors.holderPostalCode.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2">
        <div className="space-y-2">
          <Label>Número do endereço</Label>
          <Input {...form.register("holderAddressNumber")} />
          {form.formState.errors.holderAddressNumber && (
            <p className="text-xs text-destructive">{form.formState.errors.holderAddressNumber.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Parcelas</Label>
          <Select
            defaultValue="1"
            onValueChange={(v) => form.setValue("installments", Number(v) as any)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {installmentOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}x de R$ {((amountCents / n) / 100).toFixed(2).replace(".", ",")}
                  {n > 1 ? " (com juros)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" /> Processando…
          </>
        ) : (
          `Pagar R$ ${(amountCents / 100).toFixed(2).replace(".", ",")}`
        )}
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        Os dados do cartão são enviados diretamente ao Asaas (PCI-DSS) e nunca ficam em nosso banco.
      </p>
    </form>
  );
}
