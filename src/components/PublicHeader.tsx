import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";

export function PublicHeader() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4">
          <Link to="/" className="shrink-0 justify-self-start">
            <Logo />
          </Link>

          {/* Desktop nav — centralizado pelo grid */}
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

          <div /> {/* coluna direita vazia para equilibrar o grid */}
        </div>
      </header>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </>
  );
}
