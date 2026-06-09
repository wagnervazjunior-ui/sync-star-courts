import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";

export function PublicHeader() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">

          {/* Logo — esquerda */}
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>

          {/* Nav — ocupa o espaço restante e centraliza o conteúdo */}
          <nav className="hidden flex-1 items-center justify-center gap-6 md:flex">
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

          {/* Espaçador invisível com a mesma largura do logo para balancear */}
          <div className="invisible hidden shrink-0 md:block" aria-hidden>
            <Logo />
          </div>

        </div>
      </header>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </>
  );
}
