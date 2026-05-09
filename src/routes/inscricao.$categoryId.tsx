import { createFileRoute, useNavigate, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Ruler, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const SHIRT_SIZES = ["P", "M", "G", "GG", "XG"] as const;

const schema = z.object({
  contact_email: z.string().email("E-mail inválido"),
  contact_phone: z.string().min(10, "WhatsApp inválido"),
  team_name: z.string().trim().min(2, "Informe o nome da dupla").max(80),
  athlete1_name: z.string().min(2, "Informe o nome"),
  athlete1_shirt_size: z.enum(SHIRT_SIZES),
  athlete1_shorts_size: z.enum(SHIRT_SIZES),
  athlete1_birthdate: z.string().optional(),
  athlete2_name: z.string().min(2, "Informe o nome"),
  athlete2_shirt_size: z.enum(SHIRT_SIZES),
  athlete2_shorts_size: z.enum(SHIRT_SIZES),
  athlete2_birthdate: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export const Route = createFileRoute("/inscricao/$categoryId")({
  head: () => ({ meta: [{ title: "Inscrição — Open Sync" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const { categoryId } = Route.useParams();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const { data: ctx } = useQuery({
    queryKey: ["category-ctx", categoryId],
    queryFn: async () => {
      const { data: cat, error } = await supabase.from("categories").select("*, championship:championships(*)").eq("id", categoryId).maybeSingle();
      if (error) throw error;
      if (!cat) throw notFound();
      return cat;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { athlete1_shirt_size: "M", athlete1_shorts_size: "M", athlete2_shirt_size: "M", athlete2_shorts_size: "M" } as any,
  });

  const ageMode = ctx?.age_rule_mode ?? "none";
  const requiresAge = ageMode !== "none";
  const championshipYear = ctx?.championship?.start_date
    ? new Date(ctx.championship.start_date).getUTCFullYear()
    : new Date().getUTCFullYear();

  const onSubmit = async (values: FormValues) => {
    if (requiresAge) {
      if (!values.athlete1_birthdate || !values.athlete2_birthdate) {
        toast.error("Informe a data de nascimento de cada atleta");
        return;
      }
      const a1 = championshipYear - new Date(values.athlete1_birthdate).getUTCFullYear();
      const a2 = championshipYear - new Date(values.athlete2_birthdate).getUTCFullYear();
      const min = Number(ctx?.age_min ?? 0);
      if (ageMode === "individual_min" && (a1 < min || a2 < min)) {
        toast.error(`Cada atleta precisa ter pelo menos ${min} anos em ${championshipYear}`);
        return;
      }
      if (ageMode === "sum_min" && (a1 + a2) < min) {
        toast.error(`A soma das idades em ${championshipYear} precisa ser ≥ ${min}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("create_registration", {
        payload: { category_id: categoryId, ...values },
      });
      if (error) {
        if (error.message.includes("SLOTS_FULL")) toast.error("Vagas esgotadas para esta categoria");
        else if (error.message.includes("AGE_RULE_VIOLATION")) toast.error("As idades não atendem à regra desta categoria");
        else if (error.message.includes("BIRTHDATE_REQUIRED")) toast.error("Informe a data de nascimento de cada atleta");
        else if (error.message.includes("duplicate")) toast.error("Já existe inscrição com este e-mail");
        else toast.error(error.message);
        return;
      }
      const result = data as { voucher_code: string };
      toast.success("Inscrição criada!");
      navigate({ to: "/sucesso/$voucher", params: { voucher: result.voucher_code } });
    } finally {
      setSubmitting(false);
    }
  };

  const isMixed = ctx?.gender === "mixed";
  const athleteLabels = isMixed ? ["Atleta masculino", "Atleta feminina"] : ["Atleta 1", "Atleta 2"];

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        {ctx && (
          <div className="mb-6">
            <Link to="/campeonatos/$slug" params={{ slug: ctx.championship.slug }} className="text-sm text-primary hover:underline">← {ctx.championship.name}</Link>
            <h1 className="mt-2 text-3xl font-bold">Inscrição — {ctx.name}</h1>
            <p className="mt-1 text-muted-foreground">R$ {(ctx.price_cents / 100).toFixed(2).replace(".", ",")} por dupla</p>
          </div>
        )}

        <Card className="p-6 bg-gradient-card border-border/50">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label>E-mail de contato da dupla</Label>
              <Input type="email" {...form.register("contact_email")} />
              {form.formState.errors.contact_email && <p className="text-xs text-destructive">{form.formState.errors.contact_email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>WhatsApp da dupla</Label>
              <Input
                placeholder="(11) 99999-9999"
                {...form.register("contact_phone")}
                onChange={(e) => form.setValue("contact_phone", maskPhone(e.target.value))}
              />
              {form.formState.errors.contact_phone && <p className="text-xs text-destructive">{form.formState.errors.contact_phone.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Nome da dupla</Label>
              <Input {...form.register("team_name")} placeholder="Ex: Os Invencíveis" />
              {form.formState.errors.team_name && <p className="text-xs text-destructive">{form.formState.errors.team_name.message}</p>}
            </div>

            {ctx && <UniformNotice championship={ctx.championship} />}

            {[1, 2].map((n) => (
              <div key={n} className="rounded-lg border border-border/50 p-4 space-y-4">
                <h3 className="font-semibold text-primary">{athleteLabels[n - 1]}</h3>
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input {...form.register(`athlete${n}_name` as any)} />
                </div>
                {requiresAge && (
                  <div className="space-y-2">
                    <Label>Data de nascimento</Label>
                    <Input type="date" {...form.register(`athlete${n}_birthdate` as any)} />
                    <p className="text-xs text-muted-foreground">
                      {ctx?.age_rule_mode === "individual_min"
                        ? `Cada atleta precisa ter pelo menos ${ctx.age_min} anos em ${championshipYear}.`
                        : `A soma das idades da dupla em ${championshipYear} precisa ser ≥ ${ctx?.age_min}.`}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Tamanhos do uniforme</p>
                  {ctx && <SizeChartLink urls={ctx.championship.shirt_size_chart_urls ?? []} />}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Camiseta</Label>
                    <Select
                      defaultValue="M"
                      onValueChange={(v) => form.setValue(`athlete${n}_shirt_size` as any, v as any)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SHIRT_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Shorts</Label>
                    <Select
                      defaultValue="M"
                      onValueChange={(v) => form.setValue(`athlete${n}_shorts_size` as any, v as any)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SHIRT_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Enviando…" : "Confirmar inscrição"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}

function UniformNotice({ championship }: { championship: any }) {
  const until = championship?.shirt_size_guarantee_until;
  if (!until) return null;
  const date = new Date(until);
  const formatted = date.toLocaleDateString("pt-BR");
  const expired = date.getTime() < Date.now();
  return (
    <Alert className={expired ? "border-destructive/40" : "border-primary/40"}>
      <AlertTriangle className="size-4" />
      <AlertDescription>
        {expired
          ? `O prazo de garantia do tamanho do uniforme expirou em ${formatted}. O tamanho está sujeito à disponibilidade.`
          : `Garantimos a troca do tamanho para inscrições feitas até ${formatted}. Após essa data, o tamanho fica sujeito à disponibilidade.`}
      </AlertDescription>
    </Alert>
  );
}

function SizeChartLink({ urls }: { urls: string[] }) {
  if (!urls?.length) return null;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
          <Ruler className="size-3" /> Ver tabela de medidas
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Tabela de medidas do uniforme</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {urls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt="Tabela de medidas" className="w-full rounded-md border border-border/50" />
            </a>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
