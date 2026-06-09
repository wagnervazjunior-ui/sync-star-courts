import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";

export function PublicHeader() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="relative mx-auto flex h-14 max-w-6xl items-center px-4">
          {/* Logo — esquerda */}
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>

          {/* Nav — absolutamente centralizado dentro da barra */}
          <nav className="absolute inset-0 hidden items-center justify-center gap-6 md:flex pointer-events-none">
            <Link to="/campeonatos" className="pointer-events-auto text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Campeonatos
            </Link>
            <Link to="/tabelas" className="pointer-events-auto text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Tabelas
            </Link>
            <Link to="/voucher" className="pointer-events-auto text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Consultar voucher
            </Link>
          </nav>
        </div>
      </header>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </>
  );
}
