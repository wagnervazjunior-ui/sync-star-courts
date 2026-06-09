import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Trophy, ListChecks, LogOut, ArrowLeft, Shield, Users, Network, Medal, Menu } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Open Sync" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { user, isAdmin, isMaster, isReferee, loading, rolesLoading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (isReferee && !pathname.startsWith("/admin/chaves")) {
      navigate({ to: "/admin/chaves" });
    }
  }, [isReferee, pathname, navigate]);

  if (loading || rolesLoading) return <div className="min-h-screen p-8 text-muted-foreground">Carregando…</div>;
  if (!user) return null;

  // Árbitros só veem a seção de Chaves
  if (isReferee) {
    return (
      <div className="min-h-screen flex">
        <aside className="hidden md:flex w-64 flex-col border-r border-border bg-gradient-to-b from-card to-card/80 p-4 shadow-sm">
          <Link to="/admin/chaves" className="block"><Logo /></Link>
          <p className="mt-4 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Árbitro</p>
          <Separator className="mt-2 mb-3" />
          <nav className="flex flex-col gap-1">
            <NavItem to="/admin/chaves" icon={Network} label="Chaves" />
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
          <div className="md:hidden flex items-center justify-between border-b border-border bg-card px-4 h-14 shadow-sm">
            <Logo />
            <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)}>
              <Menu className="size-5" />
            </Button>
          </div>
          <div className="p-4 md:p-8"><Outlet /></div>
        </main>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="p-4 border-b border-border/40">
              <SheetTitle asChild><Logo /></SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 p-3">
              <DrawerNavItem to="/admin/chaves" icon={Network} label="Chaves" onClick={() => setMenuOpen(false)} />
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border/40">
              <p className="text-xs text-muted-foreground truncate px-1 mb-2">{user.email}</p>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>
                <LogOut className="size-4" /> Sair
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

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
          <NavItem to="/admin/staffs" icon={Users} label="Staffs" />
          <NavItem to="/admin/chaves" icon={Network} label="Chaves" />
          {isMaster && <NavItem to="/admin/premiacoes" icon={Medal} label="Premiações" />}
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
        <div className="md:hidden flex items-center justify-between border-b border-border bg-card px-4 h-14 shadow-sm">
          <Logo />
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" />
          </Button>
        </div>
        <div className="p-4 md:p-8"><Outlet /></div>
      </main>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          <SheetHeader className="p-4 border-b border-border/40 shrink-0">
            <SheetTitle asChild><Logo /></SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
            <DrawerNavItem to="/admin" icon={LayoutDashboard} label="Dashboard" exact onClick={() => setMenuOpen(false)} />
            <DrawerNavItem to="/admin/campeonatos" icon={Trophy} label="Campeonatos" onClick={() => setMenuOpen(false)} />
            <DrawerNavItem to="/admin/inscricoes" icon={ListChecks} label="Inscrições" onClick={() => setMenuOpen(false)} />
            {isMaster && <DrawerNavItem to="/admin/administradores" icon={Shield} label="Administradores" onClick={() => setMenuOpen(false)} />}
            <DrawerNavItem to="/admin/staffs" icon={Users} label="Staffs" onClick={() => setMenuOpen(false)} />
            <DrawerNavItem to="/admin/chaves" icon={Network} label="Chaves" onClick={() => setMenuOpen(false)} />
            {isMaster && <DrawerNavItem to="/admin/premiacoes" icon={Medal} label="Premiações" onClick={() => setMenuOpen(false)} />}
          </nav>
          <div className="p-3 border-t border-border/40 shrink-0">
            <p className="text-xs text-muted-foreground truncate px-1 mb-2">{user.email}</p>
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>
              <LogOut className="size-4 mr-2" /> Sair
            </Button>
          </div>
        </SheetContent>
      </Sheet>
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

function DrawerNavItem({ to, icon: Icon, label, exact, onClick }: { to: string; icon: any; label: string; exact?: boolean; onClick?: () => void }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: exact || to === "/admin" }}
      className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent/60 hover:text-foreground [&.active]:bg-gradient-primary [&.active]:text-primary-foreground [&.active]:shadow-elegant"
      activeProps={{ className: "active" }}
      onClick={onClick}
    >
      <Icon className="size-5" /> {label}
    </Link>
  );
}
