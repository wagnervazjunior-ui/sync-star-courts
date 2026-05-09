import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Trash2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/admin/administradores")({
  head: () => ({ meta: [{ title: "Administradores — Open Sync" }] }),
  component: AdministradoresPage,
});

type AdminRow = { user_id: string; email: string; role: "admin" | "master"; created_at: string };

function AdministradoresPage() {
  const { user, isMaster, loading: authLoading, rolesLoading } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !rolesLoading && !isMaster) navigate({ to: "/admin" });
  }, [authLoading, rolesLoading, isMaster, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_admins");
    if (error) toast.error(error.message);
    else setList((data as AdminRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (isMaster) load(); }, [isMaster]);

  const handlePromote = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("promote_user_to_admin", { _email: email.trim() });
    setBusy(false);
    if (error) {
      const msg = error.message.includes("USER_NOT_FOUND")
        ? "E-mail não encontrado. O usuário precisa criar conta antes."
        : error.message.includes("FORBIDDEN") ? "Sem permissão." : error.message;
      toast.error(msg);
      return;
    }
    toast.success("Usuário promovido a admin.");
    setEmail("");
    load();
  };

  const handleRevoke = async (row: AdminRow) => {
    if (!confirm(`Revogar admin de ${row.email}?`)) return;
    const { error } = await supabase.rpc("revoke_admin", { _user_id: row.user_id });
    if (error) { toast.error(error.message); return; }
    toast.success("Admin revogado.");
    load();
  };

  if (authLoading || !isMaster) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Shield className="size-7 text-primary" /> Administradores</h1>
        <p className="text-muted-foreground mt-1">Apenas o admin master pode promover ou revogar acessos.</p>
        <p className="text-xs text-muted-foreground mt-1">Para definir quais campeonatos cada admin enxerga, abra o campeonato e use a aba <strong>Permissões</strong>.</p>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><UserPlus className="size-4" /> Promover usuário</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1">
            <Label>E-mail da conta</Label>
            <Input
              type="email"
              placeholder="usuario@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePromote()}
            />
          </div>
          <Button variant="hero" disabled={busy || !email.trim()} onClick={handlePromote} className="sm:self-end">
            {busy ? "..." : "Promover"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          A pessoa precisa ter criado conta em <code>/login</code> antes.
        </p>
      </Card>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="font-semibold mb-4">Equipe atual</h2>
        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando…</p>
        ) : list.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum administrador.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {list.map((row) => {
              const isSelf = row.user_id === user?.id;
              return (
                <li key={`${row.user_id}-${row.role}`} className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.email}{isSelf && <span className="text-xs text-muted-foreground ml-2">(você)</span>}</p>
                    <p className="text-xs text-muted-foreground">desde {new Date(row.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.role === "master" ? (
                      <Badge className="bg-gradient-primary text-primary-foreground">Master</Badge>
                    ) : (
                      <Badge variant="secondary">Admin</Badge>
                    )}
                    {row.role === "admin" && (
                      <Button size="sm" variant="ghost" onClick={() => handleRevoke(row)} title="Revogar">
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
