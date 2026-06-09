import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRefereeInvite, registerReferee } from "@/lib/referee.functions";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Network } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/arbitro/cadastro/$token")({
  head: () => ({ meta: [{ title: "Cadastro de Árbitro — Open Sync" }] }),
  component: RefereeRegisterPage,
});

function RefereeRegisterPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const callGet = useServerFn(getRefereeInvite);
  const callRegister = useServerFn(registerReferee);

  const [checking, setChecking] = useState(true);
  const [championship, setChampionship] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });

  useEffect(() => {
    callGet({ data: { token } })
      .then((r) => {
        if (r.ok) setChampionship(r.championship);
      })
      .finally(() => setChecking(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Informe seu nome"); return; }
    if (!form.email.trim()) { toast.error("Informe seu e-mail"); return; }
    if (form.password.length < 6) { toast.error("A senha precisa ter pelo menos 6 caracteres"); return; }
    if (form.password !== form.confirm) { toast.error("As senhas não coincidem"); return; }

    setSubmitting(true);
    try {
      await callRegister({ data: { token, name: form.name, email: form.email, password: form.password } });
      toast.success("Cadastro concluído! Faça login para acessar as chaves.");
      navigate({ to: "/login" });
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("INVITE_INVALID")) toast.error("Link inválido ou expirado.");
      else if (msg.includes("already registered")) toast.error("E-mail já cadastrado. Faça login normalmente.");
      else toast.error(msg || "Erro ao cadastrar.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <main className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!championship) {
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <main className="mx-auto max-w-md px-4 py-12">
          <Card className="p-8 text-center">
            <h1 className="text-xl font-bold">Link inválido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este link de cadastro não está mais ativo. Solicite um novo link ao organizador.
            </p>
            <Button asChild variant="ghost" className="mt-4"><Link to="/">Voltar</Link></Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <Card className="p-8 bg-gradient-card border-border/50 shadow-elegant">
          <div className="flex items-center gap-3 mb-6">
            <div className="inline-flex size-12 items-center justify-center rounded-full bg-primary/20 text-primary">
              <Network className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Cadastro de Árbitro</h1>
              <p className="text-sm text-muted-foreground">{championship.name}</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Seu nome" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="voce@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar senha</Label>
              <Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="Repita a senha" />
            </div>

            <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Concluir cadastro
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Já tem cadastro? <Link to="/login" className="text-primary hover:underline">Fazer login</Link>
            </p>
          </form>
        </Card>
      </main>
    </div>
  );
}
