import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Open Sync" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (mode: "login" | "signup") => {
    setLoading(true);
    try {
      const { error } = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (error) throw error;
      toast.success(mode === "login" ? "Bem-vindo!" : "Conta criada!");
      navigate({ to: "/admin" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 bg-gradient-card border-border/50 shadow-elegant">
        <div className="mb-6 flex justify-center"><Link to="/"><Logo /></Link></div>
        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>
          {(["login", "signup"] as const).map((mode) => (
            <TabsContent key={mode} value={mode} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button variant="hero" className="w-full" disabled={loading} onClick={() => handle(mode)}>
                {loading ? "..." : mode === "login" ? "Entrar" : "Criar conta"}
              </Button>
            </TabsContent>
          ))}
        </Tabs>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Após criar conta, peça ao admin master para liberar seu acesso.
        </p>
      </Card>
    </div>
  );
}
