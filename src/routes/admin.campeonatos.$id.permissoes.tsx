import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Shield, Trash2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/admin/campeonatos/$id/permissoes")({
  component: PermissionsPage,
});

type Row = { user_id: string; email: string; granted_by: string | null; created_at: string };

function PermissionsPage() {
  const { id } = Route.useParams();
  const { isMaster, loading: authLoading, rolesLoading } = useAuth();
  const navigate = useNavigate();
  const [ch, setCh] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !rolesLoading && !isMaster) navigate({ to: "/admin/campeonatos/$id", params: { id } });
  }, [authLoading, rolesLoading, isMaster, navigate, id]);

  const load = async () => {
    setLoading(true);
    const [{ data: champ }, { data, error }] = await Promise.all([
      supabase.from("championships").select("name, slug").eq("id", id).maybeSingle(),
      supabase.rpc("list_championship_admins", { _championship_id: id }),
    ]);
    setCh(champ);
    if (error) toast.error(error.message);
    else setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (isMaster) load(); }, [isMaster, id]);

  const grant = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("grant_championship_admin", { _championship_id: id, _email: email.trim() });
    setBusy(false);
    if (error) {
      const msg = error.message.includes("USER_NOT_FOUND") ? "E-mail não encontrado."
        : error.message.includes("NOT_ADMIN") ? "Esse usuário precisa ser admin antes."
        : error.message;
      toast.error(msg);
      return;
    }
    toast.success("Acesso concedido.");
    setEmail("");
    load();
  };

  const revoke = async (userId: string, mail: string) => {
    if (!confirm(`Revogar acesso de ${mail} a este campeonato?`)) return;
    const { error } = await supabase.rpc("revoke_championship_admin", { _championship_id: id, _user_id: userId });
    if (error) { toast.error(error.message); return; }
    toast.success("Acesso revogado.");
    load();
  };

  if (authLoading || rolesLoading) return <div className="text-muted-foreground text-sm">Carregando…</div>;
  if (!isMaster) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/campeonatos/$id" params={{ id }}><ArrowLeft className="size-4" /> Voltar ao campeonato</Link>
      </Button>
      <div>
        <p className="text-sm text-muted-foreground">{ch?.name}</p>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Shield className="size-7 text-primary" /> Permissões</h1>
        <p className="text-muted-foreground mt-1">Defina quais admins podem ver e editar este campeonato. O master e o criador sempre têm acesso.</p>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><UserPlus className="size-4" /> Conceder acesso</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1">
            <Label>E-mail do admin</Label>
            <Input type="email" placeholder="admin@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && grant()} />
          </div>
          <Button variant="hero" disabled={busy || !email.trim()} onClick={grant} className="sm:self-end">{busy ? "..." : "Adicionar"}</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">A pessoa precisa ter sido promovida a admin antes em <strong>Administradores</strong>.</p>
      </Card>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-4">Admins com acesso</h2>
        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum admin adicional. Apenas master e o criador têm acesso.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {rows.map((row) => (
              <li key={row.user_id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{row.email}</p>
                  <p className="text-xs text-muted-foreground">desde {new Date(row.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => revoke(row.user_id, row.email)} title="Revogar">
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
