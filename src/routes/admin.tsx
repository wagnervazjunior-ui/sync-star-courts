import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Trophy, ListChecks, LogOut, ArrowLeft, Shield } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Open Sync" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { user, isAdmin, isMaster, loading, rolesLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || rolesLoading) return <div className="min-h-screen p-8 text-muted-foreground">Carregando…</div>;
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
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-gradient-to-b from-card to-card/80 p-4 shadow-sm">
        <Link to="/" className="block"><Logo /></Link>
        <p className="mt-4 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Administração</p>
        <Separator className="mt-2 mb-3" />
        <nav className="flex flex-col gap-1">
          <NavItem to="/admin" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/admin/campeonatos" icon={Trophy} label="Campeonatos" />
          <NavItem to="/admin/inscricoes" icon={ListChecks} label="Inscrições" />
          {isMaster && <NavItem to="/admin/administradores" icon={Shield} label="Administradores" />}
        </nav>
        <div className="mt-auto">
          <Separator className="mb-3" />
          <p className="text-xs text-muted-foreground truncate mb-2 px-1">{user.email}</p>
          <Button variant="ghost" size="sm" className="w-full justify-start text-foreground/80" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="md:hidden flex items-center justify-between border-b border-border bg-card p-3 shadow-sm">
          <Logo />
          <div className="flex gap-1 overflow-x-auto">
            <MobileNav to="/admin" icon={LayoutDashboard} label="Dashboard" />
            <MobileNav to="/admin/campeonatos" icon={Trophy} label="Camp." />
            <MobileNav to="/admin/inscricoes" icon={ListChecks} label="Insc." />
            {isMaster && <MobileNav to="/admin/administradores" icon={Shield} label="Admins" />}
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
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent/60 hover:text-foreground [&.active]:bg-gradient-primary [&.active]:text-primary-foreground [&.active]:shadow-elegant"
      activeProps={{ className: "active" }}
    >
      <Icon className="size-4" /> {label}
    </Link>
  );
}

function MobileNav({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/admin" }}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-accent/60 hover:text-foreground [&.active]:bg-gradient-primary [&.active]:text-primary-foreground [&.active]:shadow-elegant whitespace-nowrap"
      activeProps={{ className: "active" }}
    >
      <Icon className="size-3.5" /> {label}
    </Link>
  );
}
