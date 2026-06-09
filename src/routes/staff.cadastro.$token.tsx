import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getInvite, listStaffCategoriesByToken, registerStaff, STAFF_ROLES } from "@/lib/staff.functions";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/cadastro/$token")({
  head: () => ({ meta: [{ title: "Cadastro de Staff — Open Sync" }] }),
  component: StaffRegisterPage,
});

const Schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome"),
  cpf: z.string().min(11, "CPF inválido"),
  rg: z.string().trim().min(3, "RG inválido"),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  contact_email: z.string().email("E-mail inválido").or(z.literal("")).optional(),
  contact_phone: z.string().max(30).optional(),
  pix_key_type: z.enum(["cpf", "email", "phone", "random"]),
  pix_key: z.string().trim().min(1, "Informe a chave PIX"),
  category_id: z.string().uuid().optional().nullable(),
  staff_role: z.string().max(50).optional().nullable(),
});

type FormValues = z.infer<typeof Schema>;

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function StaffRegisterPage() {
  const { token } = Route.useParams();
  const nav = useNavigate();
  const callGet = useServerFn(getInvite);
  const callRegister = useServerFn(registerStaff);
  const callCategories = useServerFn(listStaffCategoriesByToken);
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    callGet({ data: { token } })
      .then((r) => {
        setValid(r.ok);
        if (r.ok) {
          callCategories({ data: { token } }).then((c) => setCategories(c.categories));
        }
      })
      .finally(() => setChecking(false));
  }, [token, callGet, callCategories]);

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: "",
      cpf: "",
      rg: "",
      birthdate: "",
      contact_email: "",
      contact_phone: "",
      pix_key_type: "cpf",
      pix_key: "",
      category_id: null,
      staff_role: null,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await callRegister({
        data: {
          token,
          ...values,
          cpf: values.cpf.replace(/\D/g, ""),
        },
      });
      toast.success("Cadastro concluído!");
      nav({ to: "/staff/painel" });
    } catch (e: any) {
      const code = e?.message ?? "";
      if (code.includes("CPF_ALREADY_REGISTERED")) {
        toast.error("Este CPF já está cadastrado. Faça login.");
        nav({ to: "/staff/login" });
      } else if (code.includes("INVITE_INVALID")) {
        toast.error("Link de cadastro inválido ou expirado.");
      } else {
        toast.error("Erro ao cadastrar. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <main className="mx-auto max-w-md px-4 py-12 text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <main className="mx-auto max-w-md px-4 py-12">
          <Card className="p-8 text-center">
            <h1 className="text-xl font-bold">Link inválido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este link de cadastro não está mais ativo. Solicite um novo link ao organizador.
            </p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-lg px-4 py-10">
        <Card className="p-8 bg-gradient-card border-border/50 shadow-elegant">
          <div className="flex items-center gap-3">
            <div className="inline-flex size-12 items-center justify-center rounded-full bg-primary/20 text-primary">
              <UserPlus className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Cadastro de Staff</h1>
              <p className="text-sm text-muted-foreground">
                Preencha seus dados para acessar o portal.
              </p>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <Field label="Nome completo" error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} placeholder="Seu nome completo" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="CPF" error={form.formState.errors.cpf?.message}>
                <Input
                  {...form.register("cpf")}
                  value={maskCpf(form.watch("cpf") || "")}
                  onChange={(e) => form.setValue("cpf", e.target.value)}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
              </Field>
              <Field label="RG" error={form.formState.errors.rg?.message}>
                <Input {...form.register("rg")} placeholder="00.000.000-0" />
              </Field>
            </div>
            <Field label="Data de nascimento" error={form.formState.errors.birthdate?.message}>
              <Input type="date" {...form.register("birthdate")} />
            </Field>
            <Field label="Área de atuação" error={form.formState.errors.staff_role?.message}>
              <Select
                value={form.watch("staff_role") ?? ""}
                onValueChange={(v) => form.setValue("staff_role", v || null)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione sua área" /></SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {categories.length > 0 && (
              <Field label="Categoria (personalizada)" error={form.formState.errors.category_id?.message}>
                <Select
                  value={form.watch("category_id") ?? ""}
                  onValueChange={(v) => form.setValue("category_id", v || null)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione sua categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="E-mail (opcional)" error={form.formState.errors.contact_email?.message}>
                <Input type="email" {...form.register("contact_email")} placeholder="voce@email.com" />
              </Field>
              <Field label="Telefone (opcional)">
                <Input {...form.register("contact_phone")} placeholder="(11) 99999-9999" />
              </Field>
            </div>

            <div className="rounded-lg border border-border/50 p-4 space-y-3">
              <p className="text-sm font-semibold">Chave PIX para reembolso</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Tipo de chave">
                  <Select
                    value={form.watch("pix_key_type")}
                    onValueChange={(v) => form.setValue("pix_key_type", v as any)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="random">Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Chave PIX" error={form.formState.errors.pix_key?.message}>
                  <Input {...form.register("pix_key")} placeholder="Sua chave PIX" />
                </Field>
              </div>
            </div>

            <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Concluir cadastro
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Já tem cadastro? <Link to="/staff/login" className="text-primary hover:underline">Entrar</Link>
            </p>
          </form>
        </Card>
      </main>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
