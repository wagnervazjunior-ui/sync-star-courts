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
  athlete1_name: z.string().min(2, "Informe o nome"),
  athlete1_phone: z.string().min(10, "Telefone inválido"),
  athlete1_shirt_size: z.enum(SHIRT_SIZES),
  athlete2_name: z.string().min(2, "Informe o nome"),
  athlete2_phone: z.string().min(10, "Telefone inválido"),
  athlete2_shirt_size: z.enum(SHIRT_SIZES),
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
    defaultValues: { athlete1_shirt_size: "M", athlete2_shirt_size: "M" } as any,
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("create_registration", {
        payload: { category_id: categoryId, ...values },
      });
      if (error) {
        if (error.message.includes("SLOTS_FULL")) toast.error("Vagas esgotadas para esta categoria");
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

            {[1, 2].map((n) => (
              <div key={n} className="rounded-lg border border-border/50 p-4 space-y-4">
                <h3 className="font-semibold text-primary">Atleta {n}</h3>
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input {...form.register(`athlete${n}_name` as any)} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>WhatsApp</Label>
                    <Input
                      placeholder="(11) 99999-9999"
                      {...form.register(`athlete${n}_phone` as any)}
                      onChange={(e) => form.setValue(`athlete${n}_phone` as any, maskPhone(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tamanho do uniforme</Label>
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
