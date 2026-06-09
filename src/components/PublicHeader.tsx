import { Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/MobileNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Shield, Network } from "lucide-react";

export function PublicHeader() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            <Link to="/campeonatos" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Campeonatos
            </Link>
            <Link to="/tabelas" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Tabelas
            </Link>
            <Link to="/voucher" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Consultar voucher
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="premium" size="sm" asChild>
                <Link to="/admin"><Shield className="size-4" /> Admin</Link>
              </Button>
            )}
            {user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
                className="hidden md:flex"
              >
                <LogOut className="size-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="sm" asChild className="hidden md:flex">
                <Link to="/login">Entrar</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </>
  );
}
