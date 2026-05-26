import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { staffLogin } from "@/lib/staff.functions";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/login")({
  head: () => ({ meta: [{ title: "Login Staff — Open Sync" }] }),
  component: StaffLoginPage,
});

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function StaffLoginPage() {
  const nav = useNavigate();
  const call = useServerFn(staffLogin);
  const [cpf, setCpf] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await call({ data: { cpf: cpf.replace(/\D/g, ""), birthdate } });
      nav({ to: "/staff/painel" });
    } catch {
      toast.error("CPF ou data de nascimento incorretos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <Card className="p-8 bg-gradient-card border-border/50 shadow-elegant">
          <div className="text-center">
            <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-primary/20 text-primary">
              <LogIn className="size-6" />
            </div>
            <h1 className="mt-3 text-2xl font-bold">Portal do Staff</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Entre com seu CPF e data de nascimento.
            </p>
          </div>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input
                value={maskCpf(cpf)}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                inputMode="numeric"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} required />
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Não tem cadastro? Peça o link ao organizador do torneio.
            </p>
          </form>
        </Card>
      </main>
    </div>
  );
}
