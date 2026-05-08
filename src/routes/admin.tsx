import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Trophy, ListChecks, LogOut, ArrowLeft, Shield } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Open Sync" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { user, isAdmin, isMaster, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading) return <div className="min-h-screen p-8 text-muted-foreground">Carregando…</div>;
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Acesso restrito</h1>
          <p className="mt-2 text-muted-foreground">Sua conta não tem permissão de administrador.</p>
          <p className="mt-2 text-xs text-muted-foreground">Peça ao admin master para promover sua conta.</p>
          <Button className="mt-6" variant="ghost" asChild><Link to="/"><ArrowLeft className="size-4" /> Voltar</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-border/40 bg-card/50 backdrop-blur p-4">
        <Link to="/"><Logo /></Link>
        <nav className="mt-8 flex flex-col gap-1">
          <NavItem to="/admin" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/admin/campeonatos" icon={Trophy} label="Campeonatos" />
          <NavItem to="/admin/inscricoes" icon={ListChecks} label="Inscrições" />
        </nav>
        <div className="mt-auto">
          <p className="text-xs text-muted-foreground truncate mb-2">{user.email}</p>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="md:hidden flex items-center justify-between border-b border-border/40 p-4">
          <Logo />
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" asChild><Link to="/admin">Dashboard</Link></Button>
            <Button size="sm" variant="ghost" asChild><Link to="/admin/campeonatos">Camp.</Link></Button>
            <Button size="sm" variant="ghost" asChild><Link to="/admin/inscricoes">Insc.</Link></Button>
          </div>
        </div>
        <div className="p-6 md:p-8"><Outlet /></div>
      </main>
    </div>
  );
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/admin" }}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground [&.active]:bg-gradient-primary [&.active]:text-primary-foreground [&.active]:shadow-elegant"
      activeProps={{ className: "active" }}
    >
      <Icon className="size-4" /> {label}
    </Link>
  );
}
