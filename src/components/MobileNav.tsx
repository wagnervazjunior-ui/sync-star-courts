import { Link } from "@tanstack/react-router";
import { Home, Trophy, Ticket, Shield, Network } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

function MobileNavItem({
  to,
  icon: Icon,
  label,
  exact,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={exact ? { exact: true } : {}}
      className="flex flex-col items-center justify-center gap-1 py-2 min-h-[52px] text-muted-foreground transition-colors duration-150 [&.active]:text-primary"
      activeProps={{ className: "active" }}
    >
      <Icon className="size-5" />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </Link>
  );
}

export function MobileNav() {
  const { isAdmin } = useAuth();
  const cols = isAdmin ? "grid-cols-5" : "grid-cols-4";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="border-t border-border/40 bg-background/95 backdrop-blur-xl pb-safe">
        <div className={`grid ${cols}`}>
          <MobileNavItem to="/" icon={Home} label="Início" exact />
          <MobileNavItem to="/campeonatos" icon={Trophy} label="Campeonatos" />
          <MobileNavItem to="/tabelas" icon={Network} label="Tabelas" />
          <MobileNavItem to="/voucher" icon={Ticket} label="Voucher" />
          {isAdmin && <MobileNavItem to="/admin" icon={Shield} label="Admin" />}
        </div>
      </div>
    </nav>
  );
}
